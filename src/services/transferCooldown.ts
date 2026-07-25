import AsyncStorage from '@react-native-async-storage/async-storage';

/** Shared cooldown across export AND import. 10 minutes. */
export const COOLDOWN_MS = 10 * 60 * 1000;
const KEY = '@catalogify/transfer-cooldown-until';

/** Milliseconds remaining on the shared cooldown; 0 when free. */
export async function getCooldownRemainingMs(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return 0;
  const until = Number(raw);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now());
}

/** Start (or restart) the shared cooldown from now. */
export async function startCooldown(): Promise<void> {
  await AsyncStorage.setItem(KEY, String(Date.now() + COOLDOWN_MS));
}
