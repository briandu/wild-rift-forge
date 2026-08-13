import type {
  ApiChampion,
  CountersResponse,
  LatestPatchResponse,
  TiersResponse,
} from './api-types';

export type {
  AbilityDto,
  AlsoPick,
  ApiChampion,
  CounterPick,
  CountersResponse,
  LatestPatchResponse,
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

export async function fetchCounters(slug: string): Promise<CountersResponse | null> {
  if (useDirectDb()) {
    const { loadCounters } = await import('./server/game');
    return loadCounters(slug);
  }
  try {
    return await apiFetch<CountersResponse>(`/counters/${slug}`);
  } catch {
    return null;
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

export async function fetchLatestPatch(): Promise<LatestPatchResponse | null> {
  if (useDirectDb()) {
    const { loadLatestPatch } = await import('./server/game');
    return loadLatestPatch();
  }
  try {
    return await apiFetch<LatestPatchResponse>('/patches/latest');
  } catch {
    return null;
  }
}
