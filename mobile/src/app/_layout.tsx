import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { View, AppState, AppStateStatus, Platform } from 'react-native';
import { useEffect, useRef, useState } from 'react';
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

  if (isLoading) return null;

  return (
    <ThemeProvider value={TumblrDark}>
      {Platform.OS !== 'web' && <NativeScreenCaptureGuard />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session?.user}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!session?.user}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <StatusBar style="light" />
          <PrivacyShield>
            <RootLayoutNav />
          </PrivacyShield>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
