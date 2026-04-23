import { createClient, AuthApiError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// React Native does not have the Navigator Locks API, so the Supabase auth-js
// library falls back to a broken path that causes "Lock was stolen by another
// request" errors on concurrent auth operations.  We replace it with a simple
// promise-based mutex queue that is safe for the single-JS-thread environment.
// On web we skip this entirely and let Supabase use navigator.locks natively.
const lockQueues = new Map<string, Array<() => void>>();
const lockHeld = new Set<string>();

function acquireLock(name: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!lockHeld.has(name)) {
      lockHeld.add(name);
      resolve();
    } else {
      if (!lockQueues.has(name)) {
        lockQueues.set(name, []);
      }
      lockQueues.get(name)!.push(resolve);
    }
  });
}

function releaseLock(name: string): void {
  const queue = lockQueues.get(name);
  if (queue && queue.length > 0) {
    const next = queue.shift()!;
    next();
  } else {
    lockHeld.delete(name);
    if (queue && queue.length === 0) {
      lockQueues.delete(name);
    }
  }
}

async function reactNativeLock<T>(
  name: string,
  _acquireTimeout: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  await acquireLock(name);
  const controller = new AbortController();
  try {
    return await fn(controller.signal);
  } finally {
    releaseLock(name);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web: detect session from URL so OAuth / magic-link tokens are picked up.
    // On native: disable so Expo Linking handles the deep-link instead.
    detectSessionInUrl: Platform.OS === 'web',
    // On native: use custom lock (navigator.locks unavailable in React Native).
    // On web: omit so Supabase uses the native navigator.locks API — required
    //         for sign-in to complete correctly in the browser.
    ...(Platform.OS !== 'web' ? { lock: reactNativeLock } : {}),
  },
});

// Intercept background token refresh failures and sign out locally.
const originalRefreshSession = supabase.auth.refreshSession.bind(supabase.auth);
supabase.auth.refreshSession = async (currentSession) => {
  const result = await originalRefreshSession(currentSession);
  if (result.error instanceof AuthApiError) {
    const msg = result.error.message?.toLowerCase() ?? '';
    const isStaleToken =
      msg.includes('refresh token not found') ||
      msg.includes('invalid refresh token') ||
      msg.includes('token has expired') ||
      msg.includes('refresh_token_not_found');
    if (isStaleToken) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  }
  return result;
};

// Derive the AsyncStorage key Supabase uses to persist the session.
const _projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0];
export const SUPABASE_SESSION_STORAGE_KEY = `sb-${_projectRef}-auth-token`;

/**
 * Proactively removes a stored session whose access token expired long enough
 * ago that the refresh token is certainly invalid too.  Call this before the
 * first `getSession()` so the Supabase SDK never attempts a doomed HTTP
 * refresh, which would otherwise log an AuthApiError to the console.
 */
export async function clearStaleSessionIfNeeded(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SUPABASE_SESSION_STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw);
    const token: string | undefined =
      stored?.access_token ?? stored?.currentSession?.access_token;
    if (!token) return;
    const parts = token.split('.');
    if (parts.length !== 3) return;
    // base64url → base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    const exp: number | undefined = payload?.exp;
    // Supabase refresh tokens expire after ~1 week by default.
    // If the access token expired more than 8 days ago the refresh token is
    // certainly gone too — clear storage now to skip the failing HTTP call.
    if (exp && Date.now() / 1000 > exp + 8 * 24 * 3600) {
      await AsyncStorage.removeItem(SUPABASE_SESSION_STORAGE_KEY);
    }
  } catch {
    // Non-critical — let the SDK handle edge cases normally.
  }
}
