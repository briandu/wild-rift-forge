import type { SupabaseClient } from '@supabase/supabase-js';

export const ACCOUNT_REGIONS = ['NA', 'EUW', 'BR', 'KR', 'SEA'] as const;
export const ACCOUNT_CHANNELS = ['Email', 'Push', 'Both'] as const;

export type AccountRegion = (typeof ACCOUNT_REGIONS)[number];
export type AccountChannel = (typeof ACCOUNT_CHANNELS)[number];

export type AccountProfile = {
  riotId: string | null;
  region: AccountRegion;
  notifyPool: boolean;
  notifyTier: boolean;
  notifyCounters: boolean;
  notifyDigest: boolean;
  channel: AccountChannel;
  proWaitlisted: boolean;
};

export type SavedMatchupRow = {
  youSlug: string;
  themSlug: string;
  lane: string;
};

type ProfileDb = {
  riot_id: string | null;
  region: string | null;
  notify_pool: boolean;
  notify_tier: boolean;
  notify_counters: boolean;
  notify_digest: boolean;
  notify_channel: string;
  pro_waitlisted_at: string | null;
};

const DEFAULT_PROFILE: AccountProfile = {
  riotId: null,
  region: 'NA',
  notifyPool: true,
  notifyTier: true,
  notifyCounters: false,
  notifyDigest: true,
  channel: 'Email',
  proWaitlisted: false,
};

function asRegion(value: string | null | undefined): AccountRegion {
  return ACCOUNT_REGIONS.includes(value as AccountRegion) ? (value as AccountRegion) : 'NA';
}

function asChannel(value: string | null | undefined): AccountChannel {
  return ACCOUNT_CHANNELS.includes(value as AccountChannel) ? (value as AccountChannel) : 'Email';
}

export function profileFromRow(row: ProfileDb | null): AccountProfile {
  if (!row) return DEFAULT_PROFILE;
  return {
    riotId: row.riot_id?.trim() || null,
    region: asRegion(row.region),
    notifyPool: row.notify_pool,
    notifyTier: row.notify_tier,
    notifyCounters: row.notify_counters,
    notifyDigest: row.notify_digest,
    channel: asChannel(row.notify_channel),
    proWaitlisted: Boolean(row.pro_waitlisted_at),
  };
}

export async function loadAccountState(supabase: SupabaseClient, userId: string) {
  await supabase.rpc('ensure_default_avatar');
  const [profileRes, poolRes, savedRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'riot_id, region, notify_pool, notify_tier, notify_counters, notify_digest, notify_channel, pro_waitlisted_at',
      )
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('user_champion_pool').select('champion_slug').eq('user_id', userId),
    supabase.from('user_saved_matchups').select('you_slug, them_slug, lane').eq('user_id', userId),
  ]);

  return {
    profile: profileFromRow(profileRes.data as ProfileDb | null),
    pool: ((poolRes.data ?? []) as Array<{ champion_slug: string }>).map((row) => row.champion_slug),
    saved: ((savedRes.data ?? []) as Array<{ you_slug: string; them_slug: string; lane: string }>).map(
      (row) => ({ youSlug: row.you_slug, themSlug: row.them_slug, lane: row.lane }),
    ),
  };
}

export async function patchProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase.from('profiles').upsert(
    { id: userId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) throw error;
}
