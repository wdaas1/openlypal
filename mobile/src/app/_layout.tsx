import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, AppState, AppStateStatus, Platform, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useSession } from '@/lib/auth/use-session';

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

/** Blurs the screen in the app switcher to protect private content */
function PrivacyShield({ children }: { children: React.ReactNode }) {
  const [obscured, setObscured] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        setObscured(true);
      } else if (next === 'active') {
        setObscured(false);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {obscured ? (
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#001935',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

function NativeScreenCaptureGuard() {
  usePreventScreenCapture();
  return null;
}

function RootLayoutNav() {
  const { data: session, isLoading } = useSession();
  const router = useRouter();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  console.log('[Auth] isLoading:', isLoading, 'session:', session?.user ? 'logged in' : 'no session');

  useEffect(() => {
    if (isLoading) {
      console.log('[Auth] Still loading session...');
      return;
    }

    if (session?.user) {
      console.log('[Auth] User found, navigating to app');
      router.replace('/(app)' as any);
    } else {
      console.log('[Auth] No user, navigating to sign-in');
      router.replace('/sign-in' as any);
    }

    // Small delay to let navigation complete before revealing
    setTimeout(() => {
      setIsNavigationReady(true);
      SplashScreen.hideAsync();
      console.log('[Auth] Splash hidden, navigation ready');
    }, 100);
  }, [session, isLoading]);

  return (
    <ThemeProvider value={TumblrDark}>
      {Platform.OS !== 'web' && <NativeScreenCaptureGuard />}
      {!isNavigationReady && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#001935', zIndex: 999, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#00CF35" size="large" />
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="light" />
          <PrivacyShield>
            <RootLayoutNav />
          </PrivacyShield>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
