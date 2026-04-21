import React from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';

type AppKeyboardProviderProps = {
  children: React.ReactNode;
};

function NoopKeyboardProvider({ children }: AppKeyboardProviderProps) {
  return <>{children}</>;
}

function loadNativeKeyboardProvider(): React.ComponentType<AppKeyboardProviderProps> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-keyboard-controller') as {
    KeyboardProvider?: React.ComponentType<AppKeyboardProviderProps>;
  };
  return mod.KeyboardProvider ?? NoopKeyboardProvider;
}

const Implementation =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ? NoopKeyboardProvider
    : loadNativeKeyboardProvider();

/**
 * `react-native-keyboard-controller` is not linked in Expo Go. Use a dev client
 * (`expo run:ios` / EAS) for full keyboard behavior; this wrapper avoids crashes
 * when opening the project in Expo Go.
 */
export function AppKeyboardProvider({ children }: AppKeyboardProviderProps) {
  return <Implementation>{children}</Implementation>;
}
