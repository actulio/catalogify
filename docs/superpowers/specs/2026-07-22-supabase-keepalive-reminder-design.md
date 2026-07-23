# Supabase keep-alive + activity-aware reminder — Design

**Date:** 2026-07-22
**Status:** Approved (design)

## Problem

The project runs on Supabase's **free tier**, which **pauses the database after 7 days of inactivity**. A paused project must be manually restored from the dashboard before the app works again.

Complicating factor: this app uses Supabase **only for photo Storage**. All catalog data (lists/items) lives in **Firestore**. So during normal use the app makes few — possibly zero — Postgres queries, and it is not certain that Storage-only traffic resets the free-tier pause timer (the pause is fundamentally about the Postgres database).

## Goal

Keep the Supabase project from pausing, using an **in-app approach** (no external server/cron), by:

1. Making opening the app produce activity that **reliably** counts against the pause timer.
2. Reminding the user to open the app **only when they actually need to** (i.e. they've been inactive), via a local notification.

## Non-goals

- External pingers (GitHub Actions, cron-job.org). Explicitly rejected in favor of a self-contained in-app solution.
- Push notifications / a notification server. Local (on-device) notifications only.
- Retroactively un-pausing an already-paused project (that remains a manual dashboard action).

## Chosen approach

**In-app weekly-ish reminder + explicit keep-alive query**, activity-aware so it only nags after real inactivity.

### 1. Keep-alive request (guaranteed-to-count activity)

A dedicated one-row Postgres table, queried on app launch. A real `select` against Postgres unambiguously counts as database activity.

One-time SQL (run once in the Supabase SQL editor / dashboard):

```sql
create table if not exists public.keepalive (
  id int primary key,
  pinged_at timestamptz default now()
);
insert into public.keepalive (id) values (1) on conflict do nothing;
alter table public.keepalive enable row level security;
create policy "keepalive readable" on public.keepalive for select using (true);
```

The `for select using (true)` policy applies to all roles (anon and authenticated), so the ping works whether or not the user is signed in. The table exposes no sensitive data.

**Module:** `src/services/keepAlive.ts`
- `pingSupabase(): Promise<boolean>` — runs `supabase.from('keepalive').select('id').limit(1)`. Returns `true` on no error, `false` otherwise. Best-effort: swallows/logs errors, never throws.

### 2. Activity-aware reminder

New dependency: **`expo-notifications`** (local notifications only; no push token / server).

**Module:** `src/services/reminders.ts`
- `setupNotifications(): Promise<void>` — sets the foreground notification handler and, on Android, ensures a notification channel exists. Called once at startup.
- `ensureNotificationPermission(): Promise<boolean>` — requests notification permission if not already granted; returns whether permission is granted. Called after sign-in (never on the sign-in screen).
- `rescheduleKeepAliveReminder(): Promise<void>` — cancels **all** scheduled notifications, then schedules **one repeating local notification** with a **5-day** time-interval trigger (`repeats: true`). Repeating guarantees that if the user ignores one nudge, another fires 5 days later.

**Interval rationale:** 5 days leaves a 2-day buffer before the 7-day pause — covers a missed day without cutting it close.

### 3. Wiring (`App.tsx`)

**Orchestrator:** `runKeepAlive()` in a small new module `src/services/activity.ts` (depends on both `keepAlive` and `reminders`, so it sits above them)
- Called on app mount, and whenever the app returns to the foreground (`AppState` change to `active`).
- **Throttled** to at most once per hour (persisted timestamp, e.g. AsyncStorage) so foreground churn doesn't spam Supabase.
- Flow:
  1. Call `pingSupabase()`.
  2. On success → `rescheduleKeepAliveReminder()` (resets the 5-day clock).
  3. On the **first launch**, ensure a reminder is scheduled even if the ping failed, so the user still gets nagged.

**Net behavior:** open the app at least once every 5 days → **no notifications ever**. Go quiet for 5 days → a nudge fires; opening the app (from the notification or otherwise) silently pings Supabase and resets the whole cycle.

Scheduled notifications persist across app restarts (OS-managed), so no custom "last activity" persistence is needed for the reminder itself — only for the hourly ping throttle.

### 4. Copy (i18n: Portuguese default + English)

- **pt (default):** Title "Catalogify" — Body "Abra o Catalogify para manter seu catálogo ativo."
- **en:** Title "Catalogify" — Body "Open Catalogify to keep your catalog awake."

Follow the app's existing language convention. If no i18n mechanism exists yet, Portuguese is the default string with English as the documented alternate.

## Error handling

- `pingSupabase()` is best-effort: any error is logged, returns `false`, never crashes the app or blocks UI.
- A failed ping does **not** clear the existing reminder (so the user still gets nudged).
- If notification **permission is denied**, the reminder simply can't fire; the keep-alive still runs whenever the app is opened. No repeated permission nagging.

## Testing

- `src/services/keepAlive.test.ts` — mock `supabase`; assert `pingSupabase()` queries `keepalive` and maps success/error to `true`/`false`.
- `src/services/reminders.test.ts` — mock `expo-notifications`; assert `rescheduleKeepAliveReminder()` calls cancel-all then schedules one repeating 5-day notification; assert `ensureNotificationPermission()` gates on the permission response.
- Throttle unit test — the once-per-hour gate returns `true` after the window elapses and `false` within it.
- `tsc --noEmit` stays clean; existing suites (app + emulator) stay green.

## Caveats (acknowledged, accepted by user)

- **Reliability ceiling:** local notifications can be throttled or suppressed by aggressive OS battery/Doze settings. This is the inherent cost of the in-app approach vs. an external pinger.
- **Permission-dependent:** if the user denies notifications, only the on-open keep-alive protects the project.
- **Effectiveness of the query assumption:** a Postgres `select` is the most defensible "activity"; if Supabase ever changes what counts, the keep-alive table remains the right lever.

## Components summary

| Unit | Purpose | Depends on |
|------|---------|-----------|
| `keepalive` table (SQL) | Cheap, real Postgres row to query | Supabase project |
| `keepAlive.ts` → `pingSupabase()` | Produce guaranteed activity | `supabase` client |
| `reminders.ts` | Set up + schedule/reschedule local reminder | `expo-notifications` |
| `activity.ts` → `runKeepAlive()` | Ping + reschedule, throttled, on launch/foreground | `keepAlive`, `reminders`, `AppState`, throttle store |
| `App.tsx` wiring | Invoke orchestrator at the right lifecycle points | orchestrator |
