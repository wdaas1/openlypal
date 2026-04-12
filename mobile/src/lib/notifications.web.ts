// Web stub — push notifications are not available on web.
// Metro resolves this file instead of notifications.ts when platform === 'web'.

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return null;
}

export async function getStoredPushToken(): Promise<string | null> {
  return null;
}

export async function sendPushTokenToBackend(_token: string): Promise<void> {
  // no-op on web
}

export function setupNotificationListeners(): () => void {
  return () => {};
}
