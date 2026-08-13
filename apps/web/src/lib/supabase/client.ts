import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicEnv } from './env';

export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY). Copy them into apps/web/.env.local.',
    );
  }
  return createBrowserClient(env.url, env.key);
}
