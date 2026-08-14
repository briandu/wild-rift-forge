import type { Champion, Patch, PatchAnalysisPayload, TierLane, TierLetter } from '@wild-rift-forge/game-data';

export interface AbilityDto {
  key: string;
  name: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  cooldown?: Array<number | null>;
  cost?: { type: string; values: Array<number | null> };
  numericSummary?: string;
  snapshotPatch?: string;
}

export interface ApiChampion extends Champion {
  id?: number;
  abilities?: AbilityDto[];
}

export interface CounterPick {
  slug: string;
  name: string;
  score: number;
  winRate: string;
  tag: 'STRONG COUNTER' | 'GOOD COUNTER';
  why: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
}

export interface AlsoPick {
  slug: string;
  name: string;
  score: number;
  winRate: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
}

export interface CountersResponse {
  stub: boolean;
  enemySlug: string;
  enemyName: string;
  lane: string;
  games: string;
  blurb: string;
  stats: Array<{ value: string; label: string }>;
  notes: string[];
  picks: CounterPick[];
  also: AlsoPick[];
  beats?: AlsoPick[];
  thin?: boolean;
  sample?: number;
  target?: number;
  abilities?: AbilityDto[];
  enemy: {
    slug: string;
    name: string;
    title: string | null;
    roles: string[];
    imageUrl: string | null;
    thumbnailUrl?: string | null;
  };
}

export interface MatchupSideDto {
  slug: string;
  name: string;
  title: string | null;
  roles: string[];
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  winRate: string | null;
  pickRate: string | null;
}

export interface MatchupResponse {
  you: MatchupSideDto;
  them: MatchupSideDto;
  lane: string;
  side: 'you' | 'them' | 'even';
  verdict: string;
  difficulty: string;
  score: number;
  confidence: string;
  sample: string;
  freshness: string;
  abilitiesYou: AbilityDto[];
  abilitiesThem: AbilityDto[];
}

export interface TierPlacementDto {
  slug: string;
  name: string;
  lane: TierLane;
  letter: TierLetter;
  score: number;
  rankInLane: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  why: string | null;
}

export interface TiersResponse {
  bracket: string;
  lane: string;
  snapshotDate: string | null;
  patchVersion: string | null;
  sourceLabel: string;
  placements: TierPlacementDto[];
}

export interface PatchChampionChangeDto {
  name: string;
  slug: string;
  kind: 'BUFF' | 'NERF' | 'ADJUST';
  wr: string | null;
  wrShift: number | null;
  lines: Array<{ k: string; t: string; imageUrl?: string }>;
  abilities?: AbilityDto[];
}

export interface LatestPatchResponse {
  patch: Patch;
  analysis: PatchAnalysisPayload | null;
  rebuilding: boolean;
  statsAsOf: string | null;
  champions: PatchChampionChangeDto[];
  items: string[];
}

export interface IconSignatureDto {
  slug: string;
  variant: 'thumb' | 'portrait' | 'captured';
  hash: string;
  color: string | null;
}

/** Reference library the browser uses to recognise champion-select portraits. */
export interface IconSignaturesResponse {
  hashAlgo: string;
  signatures: IconSignatureDto[];
}
