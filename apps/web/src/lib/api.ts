import { cache } from 'react';
import type {
  ApiChampion,
  CountersResponse,
  IconSignaturesResponse,
  LatestPatchResponse,
  MatchupResponse,
  TiersResponse,
} from './api-types';

export type {
  AbilityDto,
  AlsoPick,
  ApiChampion,
  CounterPick,
  CountersResponse,
  IconSignatureDto,
  IconSignaturesResponse,
  LatestPatchResponse,
  MatchupResponse,
  PatchChampionChangeDto,
  TierPlacementDto,
  TiersResponse,
} from './api-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function useDirectDb(): boolean {
  return Boolean(process.env.SUPABASE_DB_URL);
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchChampions(): Promise<ApiChampion[]> {
  if (useDirectDb()) {
    const { loadChampions } = await import('./server/game');
    return loadChampions();
  }
  try {
    const data = await apiFetch<{ champions: ApiChampion[] }>('/champions');
    return data.champions;
  } catch {
    return [];
  }
}

export async function fetchChampion(slug: string): Promise<ApiChampion | null> {
  if (useDirectDb()) {
    const { loadChampion } = await import('./server/game');
    return loadChampion(slug);
  }
  try {
    const data = await apiFetch<{ champion: ApiChampion }>(`/champions/${slug}`);
    return data.champion;
  } catch {
    return null;
  }
}

export async function fetchCounters(
  slug: string,
  lane?: string,
): Promise<CountersResponse | null> {
  if (useDirectDb()) {
    const { loadCounters } = await import('./server/game');
    return loadCounters(slug, lane);
  }
  try {
    const suffix = lane ? `?lane=${encodeURIComponent(lane)}` : '';
    return await apiFetch<CountersResponse>(`/counters/${slug}${suffix}`);
  } catch {
    return null;
  }
}

export async function fetchMatchup(
  you: string,
  them: string,
  lane?: string,
): Promise<MatchupResponse | null> {
  if (useDirectDb()) {
    const { loadMatchup } = await import('./server/game');
    return loadMatchup(you, them, lane);
  }
  try {
    const params = new URLSearchParams({ you, them });
    if (lane) params.set('lane', lane);
    return await apiFetch<MatchupResponse>(`/matchups?${params}`);
  } catch {
    return null;
  }
}

export async function fetchIconSignatures(): Promise<IconSignaturesResponse> {
  if (useDirectDb()) {
    const { loadIconSignatures } = await import('./server/game');
    return loadIconSignatures();
  }
  try {
    return await apiFetch<IconSignaturesResponse>('/draft/icon-signatures');
  } catch {
    // An empty library degrades capture to the manual board rather than breaking it.
    return { hashAlgo: 'dhash8x8', signatures: [] };
  }
}

export async function fetchTiers(): Promise<TiersResponse | null> {
  if (useDirectDb()) {
    const { loadTiers } = await import('./server/game');
    return loadTiers();
  }
  try {
    return await apiFetch<TiersResponse>('/tiers?bracket=diamond_plus');
  } catch {
    return null;
  }
}

export const fetchLatestPatch = cache(async function fetchLatestPatch(): Promise<LatestPatchResponse | null> {
  try {
    if (useDirectDb()) {
      const { loadLatestPatch } = await import('./server/game');
      return loadLatestPatch();
    }
    return await apiFetch<LatestPatchResponse>('/patches/latest');
  } catch (err) {
    console.warn('fetchLatestPatch failed:', err instanceof Error ? err.message : err);
    return null;
  }
});
