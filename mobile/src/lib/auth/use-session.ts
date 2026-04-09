import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { useQueryClient } from '@tanstack/react-query';

export const SESSION_QUERY_KEY = ['auth-session'] as const;

export const useSession = () => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
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
