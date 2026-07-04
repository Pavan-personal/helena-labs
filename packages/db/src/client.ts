import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from '@helena/shared';

let cached: SupabaseClient | null = null;

/**
 * Server side Supabase client that uses the secret key.
 * Bypasses RLS. Never import from browser code.
 */
export function getServerClient(): SupabaseClient {
  if (cached) return cached;
  const env = loadEnv();
  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cached;
}
