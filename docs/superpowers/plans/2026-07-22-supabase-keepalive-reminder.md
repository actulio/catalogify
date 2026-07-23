# Supabase Keep-Alive + Activity-Aware Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the free-tier Supabase project from pausing after 7 days idle, by pinging a Postgres table whenever the app opens and nudging the user with a self-rescheduling 5-day local notification when they've been inactive.

**Architecture:** A `pingSupabase()` service runs a real Postgres `select` (guaranteed activity). A `reminders` service manages a repeating 5-day local notification via `expo-notifications`. An `activity` orchestrator pings (throttled to once/hour, in memory) and resets the reminder. `App.tsx` invokes the orchestrator on mount, on app-foreground (`AppState`), and on Firebase sign-in (`onAuthStateChanged`).

**Tech Stack:** React Native + Expo SDK 57, TypeScript, `@supabase/supabase-js`, `expo-notifications` (new), Firebase Auth, Jest (`jest-expo` "app" project).

## Global Constraints

- **Expo SDK 57.** Per `AGENTS.md`, confirm the `expo-notifications` API shapes used here (notification-handler return fields, `SchedulableTriggerInputTypes.TIME_INTERVAL` trigger, `AndroidImportance`) against https://docs.expo.dev/versions/v57.0.0/ before writing each file. The code below reflects the SDK 53+ API; adjust field names only if the versioned docs differ.
- **Reminder interval is exactly 5 days = 432000 seconds, `repeats: true`.**
- **Best-effort:** the keep-alive path must never throw, block the UI, or crash the app. Log and continue.
- **Local notifications only** — no push tokens, no Expo push server.
- **Copy is a single English string** (`'Open Catalogify to keep your catalog awake.'`) to match the existing English UI strings; no i18n framework is introduced. (Deviation from the spec's pt/en note — flagged for the user; a one-line change if Portuguese is preferred.)
- **Throttle is in-memory** (module-level), not persisted (deviation from spec — a cold start *should* ping anyway, so persistence adds nothing).
- New unit tests run under the **"app"** Jest project: `npx jest --selectProjects app <path>`. Do not add them to the emulator project.
- Match existing code style: 2-space indent, named exports, `console.warn` for best-effort failures.

## File Structure

| File | Responsibility | Status |
|------|----------------|--------|
| `src/services/keepAlive.ts` | `pingSupabase()` — one Postgres select | create |
| `src/services/keepAlive.test.ts` | unit test (mocks `./supabase`) | create |
| `src/services/reminders.ts` | notification setup, permission, reschedule | create |
| `src/services/reminders.test.ts` | unit test (mocks `expo-notifications`) | create |
| `src/services/activity.ts` | `runKeepAlive()` orchestrator + throttle | create |
| `src/services/activity.test.ts` | unit test (mocks the three deps) | create |
| `App.tsx` | wire orchestrator into mount / foreground / sign-in | modify |
| `docs/supabase-keepalive.sql` | the one-time SQL the user runs | create |
| `README.md` | document the manual SQL step | modify |
| `package.json` / `package-lock.json` | add `expo-notifications` | modify |

---

### Task 1: `pingSupabase()` keep-alive query

**Files:**
- Create: `src/services/keepAlive.ts`
- Test: `src/services/keepAlive.test.ts`

**Interfaces:**
- Consumes: `supabase` from `src/services/supabase.ts`.
- Produces: `export async function pingSupabase(): Promise<boolean>` — `true` when the select returns no error, `false` on error or thrown exception. Never throws.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/keepAlive.test.ts
import { supabase } from './supabase';
import { pingSupabase } from './keepAlive';

jest.mock('./supabase', () => {
  const limit = jest.fn();
  return {
    supabase: { from: jest.fn(() => ({ select: jest.fn(() => ({ limit })) })) },
    PHOTOS_BUCKET: 'photos',
    __limit: limit,
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __limit } = require('./supabase') as { __limit: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe('pingSupabase', () => {
  it('queries the keepalive table and returns true on success', async () => {
    __limit.mockResolvedValue({ data: [{ id: 1 }], error: null });

    await expect(pingSupabase()).resolves.toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('keepalive');
  });

  it('returns false when Supabase returns an error', async () => {
    __limit.mockResolvedValue({ data: null, error: { message: 'paused' } });
    await expect(pingSupabase()).resolves.toBe(false);
  });

  it('returns false (never throws) when the query rejects', async () => {
    __limit.mockRejectedValue(new Error('network down'));
    await expect(pingSupabase()).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --selectProjects app src/services/keepAlive.test.ts`
Expected: FAIL — `Cannot find module './keepAlive'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/services/keepAlive.ts
import { supabase } from './supabase';

// A real Postgres SELECT is the most defensible "activity" against Supabase's
// free-tier 7-day pause timer. The app otherwise only talks to Storage, so this
// dedicated ping guarantees database traffic. Best-effort: never throws.
export async function pingSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase.from('keepalive').select('id').limit(1);
    if (error) {
      console.warn('Supabase keep-alive ping failed', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase keep-alive ping threw', err);
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --selectProjects app src/services/keepAlive.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/keepAlive.ts src/services/keepAlive.test.ts
git commit -m "feat: add pingSupabase keep-alive query"
```

---

### Task 2: `reminders` service (install `expo-notifications`)

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npx expo install`)
- Create: `src/services/reminders.ts`
- Test: `src/services/reminders.test.ts`

**Interfaces:**
- Consumes: `expo-notifications`, `react-native` `Platform`.
- Produces:
  - `export const KEEPALIVE_REMINDER_SECONDS = 432000`
  - `export async function setupNotifications(): Promise<void>`
  - `export async function ensureNotificationPermission(): Promise<boolean>`
  - `export async function rescheduleKeepAliveReminder(): Promise<void>` — no-op if permission denied; otherwise cancels all scheduled notifications and schedules one repeating 5-day reminder.

- [ ] **Step 1: Install the dependency**

Run: `npx expo install expo-notifications`
Expected: `expo-notifications` added to `package.json` dependencies at the SDK-57-compatible version.

- [ ] **Step 2: Write the failing test**

```typescript
// src/services/reminders.test.ts
import {
  KEEPALIVE_REMINDER_SECONDS,
  ensureNotificationPermission,
  rescheduleKeepAliveReminder,
} from './reminders';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications = require('expo-notifications');

beforeEach(() => jest.clearAllMocks());

describe('KEEPALIVE_REMINDER_SECONDS', () => {
  it('is exactly 5 days', () => {
    expect(KEEPALIVE_REMINDER_SECONDS).toBe(5 * 24 * 60 * 60);
  });
});

describe('ensureNotificationPermission', () => {
  it('does not re-request when already granted', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    await expect(ensureNotificationPermission()).resolves.toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests permission when not yet granted', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false });
    Notifications.requestPermissionsAsync.mockResolvedValue({ granted: true });
    await expect(ensureNotificationPermission()).resolves.toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });
});

describe('rescheduleKeepAliveReminder', () => {
  it('cancels all and schedules one repeating 5-day reminder when granted', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true });

    await rescheduleKeepAliveReminder();

    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.trigger.seconds).toBe(432000);
    expect(arg.trigger.repeats).toBe(true);
  });

  it('does nothing when permission is denied', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false });
    Notifications.requestPermissionsAsync.mockResolvedValue({ granted: false });

    await rescheduleKeepAliveReminder();

    expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --selectProjects app src/services/reminders.test.ts`
Expected: FAIL — `Cannot find module './reminders'`.

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/services/reminders.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 5-day repeating reminder. Leaves a 2-day buffer before Supabase's 7-day
// free-tier pause. Reset on every app open, so it only fires after real idleness.
export const KEEPALIVE_REMINDER_SECONDS = 5 * 24 * 60 * 60; // 432000

const CHANNEL_ID = 'keepalive';
const REMINDER_TITLE = 'Catalogify';
const REMINDER_BODY = 'Open Catalogify to keep your catalog awake.';

export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Keep-alive reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function rescheduleKeepAliveReminder(): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: REMINDER_TITLE, body: REMINDER_BODY },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: KEEPALIVE_REMINDER_SECONDS,
      repeats: true,
      channelId: CHANNEL_ID,
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest --selectProjects app src/services/reminders.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/services/reminders.ts src/services/reminders.test.ts
git commit -m "feat: add keep-alive reminder scheduling via expo-notifications"
```

---

### Task 3: `runKeepAlive()` orchestrator

**Files:**
- Create: `src/services/activity.ts`
- Test: `src/services/activity.test.ts`

**Interfaces:**
- Consumes: `pingSupabase` (Task 1), `rescheduleKeepAliveReminder` (Task 2), `auth` from `src/services/firebase.ts`.
- Produces:
  - `export async function runKeepAlive(now?: number): Promise<void>` — pings Supabase at most once per hour (in-memory throttle); resets the reminder whenever a user is signed in.
  - `export function __resetKeepAliveThrottle(): void` — test-only reset of the module-level throttle.

Behavior: the network ping is throttled to once/hour, but the reminder reset runs on every call **when signed in** (opening the app is itself activity, so the 5-day clock should reset each time regardless of the ping throttle).

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/activity.test.ts
import { runKeepAlive, __resetKeepAliveThrottle } from './activity';
import { pingSupabase } from './keepAlive';
import { rescheduleKeepAliveReminder } from './reminders';
import { auth } from './firebase';

jest.mock('./keepAlive', () => ({ pingSupabase: jest.fn() }));
jest.mock('./reminders', () => ({ rescheduleKeepAliveReminder: jest.fn() }));
jest.mock('./firebase', () => ({ auth: { currentUser: null } }));

const mockPing = pingSupabase as jest.Mock;
const mockReschedule = rescheduleKeepAliveReminder as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  __resetKeepAliveThrottle();
  mockPing.mockResolvedValue(true);
  (auth as { currentUser: unknown }).currentUser = null;
});

const HOUR = 60 * 60 * 1000;

describe('runKeepAlive', () => {
  it('pings on the first call', async () => {
    await runKeepAlive(1_000_000);
    expect(mockPing).toHaveBeenCalledTimes(1);
  });

  it('does not ping again within the hour', async () => {
    await runKeepAlive(1_000_000);
    await runKeepAlive(1_000_000 + HOUR - 1);
    expect(mockPing).toHaveBeenCalledTimes(1);
  });

  it('pings again after the hour elapses', async () => {
    await runKeepAlive(1_000_000);
    await runKeepAlive(1_000_000 + HOUR + 1);
    expect(mockPing).toHaveBeenCalledTimes(2);
  });

  it('does not schedule a reminder when signed out', async () => {
    await runKeepAlive(1_000_000);
    expect(mockReschedule).not.toHaveBeenCalled();
  });

  it('reschedules the reminder when signed in, even while ping is throttled', async () => {
    (auth as { currentUser: unknown }).currentUser = { uid: 'u1' };
    await runKeepAlive(1_000_000);
    await runKeepAlive(1_000_000 + 1); // throttled ping, but still a sign of activity
    expect(mockPing).toHaveBeenCalledTimes(1);
    expect(mockReschedule).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --selectProjects app src/services/activity.test.ts`
Expected: FAIL — `Cannot find module './activity'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/services/activity.ts
import { pingSupabase } from './keepAlive';
import { rescheduleKeepAliveReminder } from './reminders';
import { auth } from './firebase';

const THROTTLE_MS = 60 * 60 * 1000; // ping the network at most once per hour
let lastPingAt: number | null = null;

// Called on app mount, on foreground, and on Firebase sign-in. The Supabase
// ping is throttled (network); the reminder reset is not (opening the app is
// itself activity, so the 5-day clock should restart each time).
export async function runKeepAlive(now: number = Date.now()): Promise<void> {
  const throttled = lastPingAt !== null && now - lastPingAt < THROTTLE_MS;
  if (!throttled) {
    lastPingAt = now;
    await pingSupabase();
  }
  if (auth.currentUser) {
    await rescheduleKeepAliveReminder();
  }
}

export function __resetKeepAliveThrottle(): void {
  lastPingAt = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --selectProjects app src/services/activity.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/activity.ts src/services/activity.test.ts
git commit -m "feat: add runKeepAlive orchestrator with hourly ping throttle"
```

---

### Task 4: Wire the orchestrator into `App.tsx`

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `setupNotifications`, `runKeepAlive`, `auth`, `AppState`.
- Produces: no new exports. This is the RN lifecycle glue; its logic is already unit-tested in Tasks 1–3, so it is verified by typecheck + the manual on-device smoke in Task 5 rather than a new unit test (unit-testing `AppState`/render glue has low value and high mock cost).

- [ ] **Step 1: Update `App.tsx`**

Replace the file contents with:

```typescript
// App.tsx
import './global.css';
import './src/theme/nativewind-setup';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppFonts } from './src/theme/useAppFonts';
import { auth } from './src/services/firebase';
import { setupNotifications } from './src/services/reminders';
import { runKeepAlive } from './src/services/activity';

export default function App() {
  const { loaded, error } = useAppFonts();

  useEffect(() => {
    void setupNotifications();
    void runKeepAlive();

    // Reset the reminder as soon as a user is present (fires on sign-in and on
    // a cold start that restores a session) — this is where the permission
    // prompt surfaces, i.e. after sign-in, not on the sign-in screen.
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) void runKeepAlive();
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runKeepAlive();
    });

    return () => {
      unsubscribeAuth();
      appStateSub.remove();
    };
  }, []);

  if (error) {
    console.error('Font loading failed', error);
    return <RootNavigator />;
  }

  if (!loaded) return null;

  return <RootNavigator />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: `No errors found`. (If `onAuthStateChanged` import path differs, confirm against how `src/services/firebase.ts` / `SignInScreen.tsx` import from `firebase/auth`.)

- [ ] **Step 3: Run the full app suite to confirm no regressions**

Run: `npx jest --selectProjects app`
Expected: all suites pass (previous 18 + the new keepAlive/reminders/activity tests).

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: run keep-alive on mount, foreground, and sign-in"
```

---

### Task 5: Supabase SQL, README, and on-device verification

**Files:**
- Create: `docs/supabase-keepalive.sql`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing in code. This task delivers the manual DB setup that Task 1's `pingSupabase()` depends on at runtime, plus the on-device smoke test.

- [ ] **Step 1: Create the SQL file**

```sql
-- docs/supabase-keepalive.sql
-- Run once in the Supabase dashboard (SQL Editor) for the catalogify project.
-- Creates a tiny table the app SELECTs on launch to keep the free-tier project
-- from pausing after 7 days of inactivity. Exposes no sensitive data.

create table if not exists public.keepalive (
  id int primary key,
  pinged_at timestamptz default now()
);

insert into public.keepalive (id) values (1) on conflict do nothing;

alter table public.keepalive enable row level security;

-- Readable by all roles (anon + authenticated) so the ping works signed-in or out.
create policy "keepalive readable" on public.keepalive
  for select using (true);
```

- [ ] **Step 2: Add a README section**

Add under the existing setup/config documentation:

```markdown
## Keeping the Supabase project awake

The free Supabase tier pauses the database after 7 days of inactivity. This app
pings a tiny `keepalive` table on launch and schedules a 5-day local reminder to
reopen the app when you've been idle.

**One-time setup:** open the Supabase dashboard → SQL Editor and run
[`docs/supabase-keepalive.sql`](docs/supabase-keepalive.sql). Without this table
the launch ping logs a warning and is a no-op (the app still works).
```

- [ ] **Step 3: Commit**

```bash
git add docs/supabase-keepalive.sql README.md
git commit -m "docs: add keepalive table SQL and setup instructions"
```

- [ ] **Step 4: Manual on-device / dev-client verification** (requires your go-ahead to start a dev server)

1. Run the SQL from Step 1 in the Supabase dashboard.
2. Start the app (`npx expo start`) and sign in.
3. Confirm the notification permission prompt appears **after** sign-in (not on the sign-in screen).
4. In Supabase → Table Editor → `keepalive`, confirm the row exists (a successful `select` implies the ping ran; optionally add a temporary `console.log` in `pingSupabase` to see the `true` result in the Metro logs).
5. (Optional) Temporarily drop `KEEPALIVE_REMINDER_SECONDS` to e.g. `60` in a local build to confirm the notification fires, then restore it to `432000`.

---

## Notes on verification

- Unit tests (Tasks 1–3) run under the **app** Jest project and mock all native/network deps — no emulator or real Supabase needed.
- The emulator project (`FirebaseCatalogRepository.test.ts`) is untouched; run it only to confirm no accidental regressions: `firebase emulators:exec --only firestore,auth "npx jest --selectProjects emulator --forceExit"` (needs Java on PATH — the Android Studio JBR at `/Applications/Android Studio.app/Contents/jbr/Contents/Home` works).
- `expo-notifications` may prompt you to add its config plugin to `app.json` for a custom Android icon/color. Not required for basic local notifications; skip unless you want to customize the icon.
