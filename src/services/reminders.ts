// src/services/reminders.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 5-day repeating reminder. Leaves a 2-day buffer before Supabase's 7-day
// free-tier pause. Reset on every app open, so it only fires after real idleness.
export const KEEPALIVE_REMINDER_SECONDS = 5 * 24 * 60 * 60; // 432000

// setupNotifications() must run before rescheduleKeepAliveReminder() on Android
// so the notification channel exists before a notification targets it.
const CHANNEL_ID = 'keepalive';
const REMINDER_TITLE = 'Catalogify';
const REMINDER_BODY = 'Open Catalogify to keep your catalog awake.';

export async function setupNotifications(): Promise<void> {
  try {
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
  } catch (err) {
    console.warn('Failed to set up notifications', err);
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function rescheduleKeepAliveReminder(): Promise<void> {
  try {
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
  } catch (err) {
    console.warn('Failed to (re)schedule keep-alive reminder', err);
  }
}
