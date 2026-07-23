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
