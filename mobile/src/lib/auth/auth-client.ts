import { supabase } from '../supabase';

export { supabase };

/** Returns the current Supabase access token synchronously — always null, use getAccessToken instead */
export const getAuthToken = (): string | null => null;

/** Returns the current Supabase access token asynchronously */
export const getAccessToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};
