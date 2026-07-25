import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCooldownRemainingMs, startCooldown, COOLDOWN_MS } from './transferCooldown';

const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => store[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    store[key] = value;
  }),
  clear: jest.fn(async () => {
    Object.keys(store).forEach(key => delete store[key]);
  }),
}));

describe('transferCooldown', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('reports 0 remaining when never started', async () => {
    await expect(getCooldownRemainingMs()).resolves.toBe(0);
  });

  it('reports full duration immediately after start', async () => {
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await startCooldown();
    await expect(getCooldownRemainingMs()).resolves.toBe(COOLDOWN_MS);
  });

  it('reports 0 after the window elapses', async () => {
    const start = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(start);
    await startCooldown();
    jest.spyOn(Date, 'now').mockReturnValue(start + COOLDOWN_MS + 1);
    await expect(getCooldownRemainingMs()).resolves.toBe(0);
  });
});
