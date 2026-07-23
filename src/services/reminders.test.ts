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
