import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from '../supabase';

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
    // On mount, check for a stored session. If the stored token is stale, clear
    // it immediately so the user is routed to the login screen.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && isInvalidTokenError(error)) {
        supabase.auth.signOut();
        setSession(null);
        return;
      }
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isLoading = session === undefined;

  return {
    data: session ? { user: session.user } : null,
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
