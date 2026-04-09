import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

export interface SupabasePost {
  id: string;
  created_at: string;
  content: string | null;
  user_id: string;
  image_url: string | null;
}
