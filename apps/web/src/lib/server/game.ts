import 'server-only';

import {
  getChampionPayload,
  getChampionsPayload,
  getCountersPayload,
  getLatestPatchPayload,
  getMatchupPayload,
  getTiersPayload,
} from '@wild-rift-forge/api/payloads';
import type {
  ApiChampion,
  CountersResponse,
  LatestPatchResponse,
  MatchupResponse,
  TiersResponse,
} from '../api-types';

export async function loadChampions(): Promise<ApiChampion[]> {
  const data = await getChampionsPayload();
  return data.champions;
}

export async function loadChampion(slug: string): Promise<ApiChampion | null> {
  const data = await getChampionPayload(slug);
  return data?.champion ?? null;
}

export async function loadCounters(slug: string, lane?: string): Promise<CountersResponse> {
  return (await getCountersPayload(slug, { lane })) as CountersResponse;
}

export async function loadMatchup(
  you: string,
  them: string,
  lane?: string,
): Promise<MatchupResponse | null> {
  return (await getMatchupPayload({ you, them, lane })) as MatchupResponse | null;
}

export async function loadTiers(): Promise<TiersResponse> {
  return (await getTiersPayload({ bracket: 'diamond_plus' })) as TiersResponse;
}

export async function loadLatestPatch(): Promise<LatestPatchResponse | null> {
  return (await getLatestPatchPayload()) as LatestPatchResponse | null;
}
