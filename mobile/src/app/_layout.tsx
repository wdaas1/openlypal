import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useTheme } from '@/lib/theme';
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
  handleColdStartNotification,
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

function RootLayoutNav() {
  const { data: session, isLoading } = useSession();
  const theme = useTheme();
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
        console.log('[notifications] Sending push token to backend');
        sendPushTokenToBackend(token);
      } else {
        console.log('[notifications] No push token — push notifications unavailable');
      }
    });

    const navigate = (path: string) => router.push(path as never);
    cleanupListeners = setupNotificationListeners(navigate);
    handleColdStartNotification(navigate);

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

  // Poll for new live sessions from followed users
  const seenLiveMomentsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!session?.user) return;

    const checkLiveSessions = async () => {
      try {
        const moments = await api.get<{ id: string; title: string; creator: { name: string; username: string | null } }[]>('/api/live-moments/following');
        if (!moments) return;

        const currentIds = new Set(moments.map((m) => m.id));

        if (seenLiveMomentsRef.current !== null) {
          for (const m of moments) {
            if (!seenLiveMomentsRef.current.has(m.id)) {
              // New live session from someone we follow
              const creatorName = m.creator.name ?? m.creator.username ?? 'Someone you follow';
              if (Platform.OS !== 'web') {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: '🔴 Live Now',
                    body: `${creatorName} just started a live session: "${m.title}"`,
                    sound: true,
                  },
                  trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
                });
              }
            }
          }
        }

        seenLiveMomentsRef.current = currentIds;
      } catch {
        // Non-fatal
      }
    };

    checkLiveSessions();
    const interval = setInterval(checkLiveSessions, 10000);
    return () => {
      clearInterval(interval);
      seenLiveMomentsRef.current = null;
    };
  }, [session?.user?.id]);

  // Poll for new posts from followed users
  const seenPostIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!session?.user) return;

    const checkFollowingPosts = async () => {
      try {
        const feed = await api.get<{ id: string; _type?: string; user?: { name: string; username: string | null }; rebloggedBy?: { name: string; username: string | null } }[]>('/api/posts/feed/following');
        if (!feed) return;

        const currentIds = new Set(feed.map((item) => item.id));

        if (seenPostIdsRef.current !== null) {
          for (const item of feed) {
            if (!seenPostIdsRef.current.has(item.id)) {
              const authorName = item.rebloggedBy?.name ?? item.user?.name ?? item.rebloggedBy?.username ?? item.user?.username ?? 'Someone you follow';
              const isReblog = item._type === 'reblog';
              if (Platform.OS !== 'web') {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: isReblog ? 'New Reblog' : 'New Post',
                    body: isReblog ? `${authorName} reblogged a post` : `${authorName} just posted`,
                    sound: true,
                  },
                  trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
                });
              }
            }
          }
        }

        seenPostIdsRef.current = currentIds;
      } catch {
        // Non-fatal
      }
    };

    checkFollowingPosts();
    const interval = setInterval(checkFollowingPosts, 30000);
    return () => {
      clearInterval(interval);
      seenPostIdsRef.current = null;
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
  }, [session?.user?.id, isLoading, navigationState?.key, onboardingDone]);

  const baseNavTheme = theme.isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseNavTheme,
    colors: {
      ...baseNavTheme.colors,
      primary: '#00CF35',
      background: theme.bg,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      notification: '#FF4E6A',
    },
  };

  return (
    <ThemeProvider value={navTheme}>
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

function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemedStatusBar />
        <RootLayoutNav />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
