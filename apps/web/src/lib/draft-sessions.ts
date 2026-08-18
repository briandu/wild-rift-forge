import type { SupabaseClient } from '@supabase/supabase-js';
import { parseDraftState, type DraftState } from './draft-state';

export type DraftSessionSummary = {
  id: number;
  shareToken: string | null;
  youSlug: string | null;
  vsSlug: string | null;
  outcome: 'win' | 'loss' | null;
  durationSeconds: number | null;
  mediaPath: string | null;
  mediaKind: 'screenshot' | 'video' | null;
  createdAt: string;
  endedAt: string | null;
  thumbUrl: string | null;
};

type SessionRow = {
  id: number;
  share_token: string | null;
  you_slug: string | null;
  vs_slug: string | null;
  outcome: 'win' | 'loss' | null;
  duration_seconds: number | null;
  media_path: string | null;
  media_kind: 'screenshot' | 'video' | null;
  created_at: string;
  ended_at: string | null;
  state?: unknown;
};

function newShareToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 10)
    .toUpperCase();
}

function facesFrom(state: DraftState): { youSlug: string | null; vsSlug: string | null } {
  return {
    youSlug: state.allies[state.mySlotIndex]?.slug ?? state.allies.find((slot) => slot.slug)?.slug ?? null,
    vsSlug: state.enemies[state.mySlotIndex]?.slug ?? state.enemies.find((slot) => slot.slug)?.slug ?? null,
  };
}

function toSummary(row: SessionRow, thumbUrl: string | null = null): DraftSessionSummary {
  return {
    id: row.id,
    shareToken: row.share_token,
    youSlug: row.you_slug,
    vsSlug: row.vs_slug,
    outcome: row.outcome,
    durationSeconds: row.duration_seconds,
    mediaPath: row.media_path,
    mediaKind: row.media_kind,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    thumbUrl,
  };
}

export function shareUrlFor(token: string): string {
  if (typeof window === 'undefined') return `/draft/s/${token}`;
  return `${window.location.origin}/draft/s/${token}`;
}

export function formatSessionWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day =
    sameDay ? 'Today' : date.toDateString() === yesterday.toDateString() ? 'Yesterday' : date.toLocaleDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} · ${time}`;
}

async function signedThumb(
  supabase: SupabaseClient,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from('draft-captures').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function listDraftSessions(
  supabase: SupabaseClient,
  userId: string,
): Promise<DraftSessionSummary[]> {
  const { data, error } = await supabase
    .from('draft_sessions')
    .select(
      'id, share_token, you_slug, vs_slug, outcome, duration_seconds, media_path, media_kind, created_at, ended_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);
  if (error || !data) return [];
  return Promise.all(
    (data as SessionRow[]).map(async (row) => toSummary(row, await signedThumb(supabase, row.media_path))),
  );
}

export async function createDraftSession(
  supabase: SupabaseClient,
  userId: string,
  state: DraftState,
  source: 'manual' | 'capture',
): Promise<{ id: number; shareToken: string } | null> {
  const faces = facesFrom(state);
  const shareToken = newShareToken();
  const { data, error } = await supabase
    .from('draft_sessions')
    .insert({
      user_id: userId,
      source,
      state,
      share_token: shareToken,
      you_slug: faces.youSlug,
      vs_slug: faces.vsSlug,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id, share_token')
    .single();
  if (error || !data) return null;
  return { id: data.id as number, shareToken: data.share_token as string };
}

export async function persistDraftSession(
  supabase: SupabaseClient,
  sessionId: number,
  state: DraftState,
): Promise<void> {
  const faces = facesFrom(state);
  const duration =
    state.startedAt != null ? Math.max(0, Math.round((Date.now() - state.startedAt) / 1000)) : null;
  await supabase
    .from('draft_sessions')
    .update({
      state,
      you_slug: faces.youSlug,
      vs_slug: faces.vsSlug,
      duration_seconds: duration,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

export async function endDraftSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: number,
  state: DraftState,
  media?: { blob: Blob; kind: 'screenshot' | 'video' },
): Promise<void> {
  const faces = facesFrom(state);
  const duration =
    state.startedAt != null ? Math.max(0, Math.round((Date.now() - state.startedAt) / 1000)) : null;
  let mediaPath: string | null = null;
  if (media) {
    const ext = media.kind === 'video' ? 'webm' : 'jpg';
    mediaPath = `${userId}/${sessionId}/shot.${ext}`;
    const { error } = await supabase.storage.from('draft-captures').upload(mediaPath, media.blob, {
      upsert: true,
      contentType: media.blob.type || (media.kind === 'video' ? 'video/webm' : 'image/jpeg'),
    });
    if (error) mediaPath = null;
  }
  await supabase
    .from('draft_sessions')
    .update({
      state,
      you_slug: faces.youSlug,
      vs_slug: faces.vsSlug,
      duration_seconds: duration,
      ended_at: new Date().toISOString(),
      media_path: mediaPath,
      media_kind: mediaPath ? media?.kind ?? null : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

export async function wipeDraftSessions(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('draft_sessions').select('id, media_path').eq('user_id', userId);
  const paths = ((data ?? []) as Array<{ media_path: string | null }>)
    .map((row) => row.media_path)
    .filter((path): path is string => Boolean(path));
  if (paths.length) {
    await supabase.storage.from('draft-captures').remove(paths);
  }
  const { error } = await supabase.from('draft_sessions').delete().eq('user_id', userId);
  return !error;
}

export type SharedDraft = {
  state: DraftState;
  youSlug: string | null;
  vsSlug: string | null;
  endedAt: string | null;
};

export async function fetchSharedDraft(
  supabase: SupabaseClient,
  token: string,
): Promise<SharedDraft | null> {
  const { data, error } = await supabase.rpc('get_draft_session_by_share_token', { p_token: token });
  if (error || !data || typeof data !== 'object') return null;
  const row = data as {
    state?: unknown;
    you_slug?: string | null;
    vs_slug?: string | null;
    ended_at?: string | null;
  };
  const state = parseDraftState(JSON.stringify(row.state ?? null));
  if (!state) return null;
  return { state, youSlug: row.you_slug ?? null, vsSlug: row.vs_slug ?? null, endedAt: row.ended_at ?? null };
}
