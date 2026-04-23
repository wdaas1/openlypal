import { useState, useEffect, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthApiError } from '@supabase/supabase-js';
import { supabase, clearStaleSessionIfNeeded } from '../supabase';

export const SESSION_QUERY_KEY = ['auth-session'] as const;

const INVALID_TOKEN_MESSAGES = [
  'refresh token not found',
  'invalid refresh token',
  'token has expired',
  'refresh_token_not_found',
];

const isInvalidTokenError = (error: unknown): boolean => {
  if (!(error instanceof AuthApiError)) return false;
  const msg = error.message?.toLowerCase() ?? '';
  return INVALID_TOKEN_MESSAGES.some((pattern) => msg.includes(pattern));
};

export const useSession = () => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Clear storage-backed stale sessions before calling getSession() so the
      // SDK never makes a doomed refresh HTTP request (avoids the console error).
      await clearStaleSessionIfNeeded();
      if (cancelled) return;

      const { data: { session }, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error && isInvalidTokenError(error)) {
        await supabase.auth.signOut({ scope: 'local' });
        if (!cancelled) setSession(null);
        return;
      }
      if (!cancelled) setSession(session ?? null);
    };

    init().catch(() => {
      if (!cancelled) setSession(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const isLoading = session === undefined;

  const data = useMemo(
    () => (session ? { user: session.user } : null),
    [session],
  );

  return {
    data,
    isLoading,
  };
};

export const useInvalidateSession = () => {
  // With Supabase, session is managed automatically via onAuthStateChange
  // This is kept for compatibility but is a no-op
  return async () => {
    await supabase.auth.getSession();
  };
};
