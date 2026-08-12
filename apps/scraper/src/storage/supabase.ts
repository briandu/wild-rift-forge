import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const GAME_ASSETS_BUCKET = 'game-assets';

let client: SupabaseClient | null = null;

/**
 * Admin Supabase client for Storage uploads.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (never expose the service role to the browser).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) {
    return client;
  }
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for asset sync. ' +
        'Copy them from the Supabase dashboard (Settings → API) into .env.',
    );
  }
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function publicObjectUrl(bucket: string, path: string): string {
  const { data } = getSupabaseAdmin().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
