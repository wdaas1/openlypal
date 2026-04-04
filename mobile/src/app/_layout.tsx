import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/lib/auth/use-session';
import {
  registerForPushNotificationsAsync,
  sendPushTokenToBackend,
  setupNotificationListeners,
} from '@/lib/notifications';

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

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then((val) => {
      setOnboardingDone(val === 'true');
    });
  }, []);

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

  useEffect(() => {
    if (isLoading || !navigationState?.key || onboardingDone === null) return;

    if (session?.user) {
      if (!onboardingDone) {
        router.replace('/onboarding' as any);
      } else {
        router.replace('/(app)' as any);
      }
    } else {
      router.replace('/sign-in' as any);
    }

    SplashScreen.hideAsync();
  }, [session, isLoading, navigationState?.key, onboardingDone]);

  return (
    <ThemeProvider value={TumblrDark}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
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
