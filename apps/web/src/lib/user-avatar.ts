import type { SupabaseClient, User } from '@supabase/supabase-js';

export type ChampionAvatarMeta = {
  avatar_champion_slug?: string;
  avatar_champion_url?: string;
};

type ProfileRow = {
  avatar_champion_slug: string | null;
  avatar_url: string | null;
};

type AssignedAvatar = {
  slug?: string | null;
  url?: string | null;
};

export function avatarUrlFromUser(user: User | null | undefined): string | undefined {
  const meta = user?.user_metadata as ChampionAvatarMeta | undefined;
  const url = meta?.avatar_champion_url?.trim();
  return url || undefined;
}

const inflight = new Map<string, Promise<{ url?: string; slug?: string }>>();

export async function loadChampionAvatar(
  supabase: SupabaseClient,
  user: User,
): Promise<{ url?: string; slug?: string }> {
  const pending = inflight.get(user.id);
  if (pending) return pending;

  const task = resolveChampionAvatar(supabase, user).finally(() => {
    inflight.delete(user.id);
  });
  inflight.set(user.id, task);
  return task;
}

async function resolveChampionAvatar(
  supabase: SupabaseClient,
  user: User,
): Promise<{ url?: string; slug?: string }> {
  const fromMeta = avatarUrlFromUser(user);
  const meta = user.user_metadata as ChampionAvatarMeta;
  if (fromMeta) {
    return { url: fromMeta, slug: meta.avatar_champion_slug };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_champion_slug, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  const row = profile as ProfileRow | null;
  if (row?.avatar_url) {
    return { url: row.avatar_url, slug: row.avatar_champion_slug ?? undefined };
  }

  const { data: assigned } = await supabase.rpc('ensure_default_avatar');
  const payload = assigned as AssignedAvatar | null;
  if (payload?.url) {
    void supabase.auth.refreshSession();
    return { url: payload.url, slug: payload.slug ?? undefined };
  }

  return {};
}

export async function applyChampionAvatar(
  supabase: SupabaseClient,
  slug: string,
): Promise<{ url?: string; slug?: string }> {
  const { data, error } = await supabase.rpc('set_champion_avatar', { champ_slug: slug });
  if (error) throw error;
  const payload = data as AssignedAvatar | null;
  await supabase.auth.updateUser({
    data: {
      avatar_champion_slug: payload?.slug ?? slug,
      avatar_champion_url: payload?.url ?? '',
    },
  });
  await supabase.auth.refreshSession();
  return { url: payload?.url ?? undefined, slug: payload?.slug ?? slug };
}
