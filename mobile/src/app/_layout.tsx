import { Platform } from 'react-native';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/lib/auth/use-session';
import {
  registerForPushNotificationsAsync,
  sendPushTokenToBackend,
  setupNotificationListeners,
} from '@/lib/notifications';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api/api';
import type { Conversation } from '@/lib/types';

export const unstable_settings = {
  initialRouteName: '(app)',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const TumblrDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#001935',
    card: '#001935',
    primary: '#00CF35',
    text: '#FFFFFF',
    border: '#1a3a5c',
  },
};

function RootLayoutNav() {
  const { data: session, isLoading } = useSession();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const syncedUserId = useRef<string | null>(null);

  // Sync user profile on login: ensure backend has the user row, apply pending username
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || syncedUserId.current === userId) return;
    syncedUserId.current = userId;

    const syncProfile = async () => {
      try {
        // This call auto-creates the user in the backend DB if they don't exist yet
        const profile = await api.get<{ username?: string | null } | null>('/api/users/me');

        // Apply pending username if the profile has no username yet
        const pendingUsername = await AsyncStorage.getItem('pending_username');
        if (pendingUsername && !profile?.username) {
          await api.patch('/api/users/me', { username: pendingUsername });
          await AsyncStorage.removeItem('pending_username');
        }

        // On web, AsyncStorage (localStorage) is empty on first visit even if the
        // user already completed onboarding on native. If the backend profile
        // already has a username the user is past onboarding — mark it done so
        // they aren't sent back to /onboarding every session.
        if (profile?.username) {
          const key = `onboarding_done_${userId}`;
          const existing = await AsyncStorage.getItem(key);
          if (!existing) {
            await AsyncStorage.setItem(key, 'true');
            setOnboardingDone(true);
          }
        }
      } catch {
        // Non-critical — profile will load normally on the profile screen
      }
    };

    syncProfile();
  }, [session?.user?.id]);

  // Handle deep links for email verification (openly://?code=... or openly://?access_token=...&refresh_token=...)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.startsWith('openly://')) return;
      const parsed = Linking.parse(url);
      const params = parsed.queryParams ?? {};

      // PKCE flow: exchange code for session
      const code = params['code'];
      if (code && typeof code === 'string') {
        await supabase.auth.exchangeCodeForSession(code);
        return;
      }

      // Implicit flow: set session directly
      const accessToken = params['access_token'];
      const refreshToken = params['refresh_token'];
      if (accessToken && refreshToken && typeof accessToken === 'string' && typeof refreshToken === 'string') {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  // Load onboarding status keyed by user ID so each account has its own state
  useEffect(() => {
    const userId = session?.user?.id;
    if (isLoading) return;
    if (!userId) {
      setOnboardingDone(null);
      return;
    }
    AsyncStorage.getItem(`onboarding_done_${userId}`).then((val) => {
      setOnboardingDone(val === 'true');
    });
  }, [session?.user?.id, isLoading]);

  // Register for push notifications and set up listeners once session is ready
  useEffect(() => {
    if (!session?.user) return;

    let cleanupListeners: (() => void) | undefined;

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        sendPushTokenToBackend(token);
      }
    });

    cleanupListeners = setupNotificationListeners();

    return () => {
      cleanupListeners?.();
    };
  }, [session?.user?.id]);

  // Poll for new messages and fire a local notification when unread count increases
  const prevUnreadRef = useRef<number | null>(null);
  useEffect(() => {
    if (!session?.user) return;

    const checkMessages = async () => {
      try {
        const conversations = await api.get<Conversation[]>('/api/conversations');
        if (!conversations) return;

        const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

        if (prevUnreadRef.current !== null && totalUnread > prevUnreadRef.current) {
          // Find the conversation that has a new unread message
          const newConv = conversations.find((c) => c.unreadCount > 0);
          const senderName = newConv?.user?.name ?? newConv?.user?.username ?? 'Someone';

          if (Platform.OS !== 'web') {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'New Message',
                body: senderName,
                sound: true,
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
            });
          }
        }

        prevUnreadRef.current = totalUnread;
      } catch {
        // Non-fatal — polling will retry
      }
    };

    checkMessages();
    const interval = setInterval(checkMessages, 5000);
    return () => {
      clearInterval(interval);
      prevUnreadRef.current = null;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (isLoading || !navigationState?.key) return;

    let cancelled = false;
    (async () => {
      if (session?.user) {
        // Read fresh from AsyncStorage every time instead of trusting React state.
        // On web (localStorage), the state can be stale after onboarding completes
        // or when a Supabase token refresh triggers this effect after navigation.
        const val = await AsyncStorage.getItem(`onboarding_done_${session.user.id}`);
        if (cancelled) return;
        if (val !== 'true') {
          router.replace('/onboarding' as any);
        } else {
          router.replace('/(app)' as any);
        }
      } else {
        if (cancelled) return;
        setOnboardingDone(null);
        router.replace('/welcome' as any);
      }
      if (!cancelled) SplashScreen.hideAsync();
    })();
    return () => { cancelled = true; };
  }, [session, isLoading, navigationState?.key, onboardingDone]);

  return (
    <ThemeProvider value={TumblrDark}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <RootLayoutNav />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
