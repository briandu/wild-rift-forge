import type { Champion } from '@wild-rift-forge/game-data';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiChampion extends Champion {
  id?: number;
}

export interface CounterPick {
  slug: string;
  name: string;
  score: number;
  winRate: string;
  tag: 'STRONG COUNTER' | 'GOOD COUNTER';
  why: string;
}

export interface AlsoPick {
  slug: string;
  name: string;
  score: number;
  winRate: string;
}

export interface CountersResponse {
  stub: true;
  enemySlug: string;
  enemyName: string;
  lane: string;
  games: string;
  blurb: string;
  stats: Array<{ value: string; label: string }>;
  notes: string[];
  picks: CounterPick[];
  also: AlsoPick[];
  enemy: {
    slug: string;
    name: string;
    title: string | null;
    roles: string[];
    imageUrl: string | null;
  };
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
  try {
    const data = await apiFetch<{ champions: ApiChampion[] }>('/champions');
    return data.champions;
  } catch {
    return [];
  }
}

export async function fetchChampion(slug: string): Promise<ApiChampion | null> {
  try {
    const data = await apiFetch<{ champion: ApiChampion }>(`/champions/${slug}`);
    return data.champion;
  } catch {
    return null;
  }
}

export async function fetchCounters(slug: string): Promise<CountersResponse | null> {
  try {
    return await apiFetch<CountersResponse>(`/counters/${slug}`);
  } catch {
    return null;
  }
}

export function getApiUrl(): string {
  return API_URL;
}
