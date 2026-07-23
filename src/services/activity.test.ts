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
