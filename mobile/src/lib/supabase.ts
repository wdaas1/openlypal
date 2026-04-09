import { createClient, AuthApiError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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
