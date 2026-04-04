import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import burnt from 'burnt';

const PUSH_TOKEN_KEY = 'expo_push_token';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on real devices
  if (!Device.isDevice) {
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00CF35',
    });
  }

  // Check existing permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Get the project ID from Expo config
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // Cache token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    return token;
  } catch {
    return null;
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function sendPushTokenToBackend(token: string): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!baseUrl) return;

  try {
    await fetch(`${baseUrl}/api/users/me/push-token`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pushToken: token }),
    });
  } catch {
    // Non-fatal — token will be sent on next app open
  }
}

export function setupNotificationListeners(): () => void {
  // Fired when a notification is received while the app is in the foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const title = notification.request.content.title ?? 'New notification';
      const body = notification.request.content.body ?? '';

      burnt.toast({
        title,
        message: body,
        preset: 'custom',
        icon: {
          ios: { name: 'bell.fill', color: '#00CF35' },
        },
        duration: 4,
      });
    }
  );

  // Fired when the user taps on a notification (app in background/killed)
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((_response) => {
      // Navigation on tap can be wired up here if needed
    });

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
