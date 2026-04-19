import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'theme_mode';

export const DARK = {
  bg: '#001935',
  card: '#0a2d50',
  cardAlt: '#081828',
  text: '#FFFFFF',
  subtext: '#4a6fa5',
  border: '#1a3a5c',
  accent: '#00CF35',
  accentText: '#001935',
  inputBg: '#001935',
  danger: '#FF4E6A',
  tabBar: 'rgba(0,12,28,0.82)',
  tabBarTint: 'dark' as const,
  shimmer: 'rgba(255,255,255,0.07)',
  isDark: true,
};

export const LIGHT = {
  bg: '#F0F4F8',
  card: '#FFFFFF',
  cardAlt: '#F8FAFC',
  text: '#001935',
  subtext: '#5a7fa5',
  border: '#E2E8F0',
  accent: '#00CF35',
  accentText: '#001935',
  inputBg: '#FFFFFF',
  danger: '#FF4E6A',
  tabBar: 'rgba(248,250,252,0.92)',
  tabBarTint: 'light' as const,
  shimmer: 'rgba(0,0,0,0.04)',
  isDark: false,
};

export type Theme = {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  accentText: string;
  inputBg: string;
  danger: string;
  tabBar: string;
  tabBarTint: 'dark' | 'light';
  shimmer: string;
  isDark: boolean;
};
export type ThemeMode = 'dark' | 'light' | 'system';

type ThemeStore = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

export const useThemeStore = create<ThemeStore>((set) => {
  // Load persisted mode on startup
  AsyncStorage.getItem(STORAGE_KEY).then((val) => {
    if (val === 'dark' || val === 'light' || val === 'system') {
      set({ mode: val });
    }
  });

  return {
    mode: 'dark',
    setMode: (mode) => {
      set({ mode });
      AsyncStorage.setItem(STORAGE_KEY, mode);
    },
  };
});

export function useThemeMode(): ThemeMode {
  return useThemeStore((s) => s.mode);
}

export function useSetThemeMode(): (mode: ThemeMode) => void {
  return useThemeStore((s) => s.setMode);
}

export function useTheme(): Theme {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  if (mode === 'system') {
    return systemScheme === 'dark' ? DARK : LIGHT;
  }
  return mode === 'light' ? LIGHT : DARK;
}
