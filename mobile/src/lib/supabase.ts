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

// Automatically sign out when a stale/invalid refresh token is detected.
// This prevents the app from being stuck in a broken auth state after the
// stored session expires or is revoked on the server.
supabase.auth.onAuthStateChange((event, _session) => {
  // The Supabase client emits a TOKEN_REFRESHED event on success, but when
  // token refresh fails it fires SIGNED_OUT. However on some SDK versions the
  // error surfaces before the sign-out is triggered, so we also listen at the
  // client level to clear storage proactively.
  if (event === 'SIGNED_OUT') return; // already handled by the client
});

// Intercept background token refresh failures
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
      await supabase.auth.signOut();
    }
  }
  return result;
};
