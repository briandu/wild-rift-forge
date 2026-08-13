/**
 * Canonical Wild Rift Forge game-data types.
 *
 * These types are the internal source of truth consumed by the API, web app,
 * and recommendation engine. They must know nothing about Riot's HTML or
 * page structures — the scraper normalizes source-specific data into these shapes.
 */

export type EntityType = 'champion' | 'item' | 'rune' | 'system';

export type ChangeType = 'buff' | 'nerf' | 'adjustment' | 'new' | 'rework' | 'unknown';

/** A Wild Rift patch (e.g. "7.2b"). */
export interface Patch {
  /** Normalized version string, e.g. "7.2b". Unique. */
  version: string;
  /** Human title, e.g. "Wild Rift Patch Notes 7.2b". */
  title: string;
  /** ISO date the patch notes were published. */
  releaseDate: string | null;
  /** Canonical source URL of the patch notes. */
  sourceUrl: string;
}

/** A single normalized change within a patch. History is append-only. */
export interface PatchChange {
  entityType: EntityType;
  /** Champion/item/rune name, or a section label for system changes. */
  entityName: string;
  changeType: ChangeType;
  /** Ability or section the change belongs to (e.g. "Prowl", "Base Stats"). */
  ability: string | null;
  /** The changed property, e.g. "Base Armor". */
  property: string | null;
  /** Pre-change value. Stored as jsonb; string when not further parseable. */
  oldValue: unknown | null;
  /** Post-change value. */
  newValue: unknown | null;
  /** Human-readable description preserved from the source. */
  description: string | null;
  /** Irregular extra data (source section titles, raw HTML snippets, etc.). */
  metadata: Record<string, unknown> | null;
}

/** A Wild Rift champion. */
export interface Champion {
  /** URL-safe unique identifier, e.g. "aatrox". */
  slug: string;
  name: string;
  /** Flavor title, e.g. "The Darkin Blade". */
  title: string | null;
  /** Role ids, e.g. ["fighter"]. */
  roles: string[];
  /** Difficulty label, e.g. "Medium". */
  difficulty: string | null;
  /** Public URL served to clients (hosted Storage URL once synced). */
  imageUrl: string | null;
  /** Upstream Riot CDN URL used as the download source for asset sync. */
  imageSourceUrl?: string | null;
  /** Square face-crop for avatars and tiles (hosted Storage URL once synced). */
  thumbnailUrl?: string | null;
  /** Upstream WildRiftFire/Mobafire URL used as the thumbnail download source. */
  thumbnailSourceUrl?: string | null;
}

/** Ability slot as shown on Riot champion pages. */
export type AbilitySlot = 'passive' | '1' | '2' | '3' | 'ultimate';

/** Keyboard hotkey shown in the kit UI. */
export type AbilityHotkey = 'P' | 'Q' | 'W' | 'E' | 'R';

const HOTKEY_BY_SLOT: Record<AbilitySlot, AbilityHotkey> = {
  passive: 'P',
  '1': 'Q',
  '2': 'W',
  '3': 'E',
  ultimate: 'R',
};

export function abilityHotkey(slot: AbilitySlot): AbilityHotkey {
  return HOTKEY_BY_SLOT[slot];
}

export type RankBracket = 'all' | 'diamond_plus' | 'master_plus' | 'challenger_plus' | 'legendary';

export type TierLane = 'Top' | 'Jungle' | 'Mid' | 'Dragon' | 'Support';

export type TierLetter = 'S' | 'A' | 'B' | 'C';

export const TIER_LANES: readonly TierLane[] = ['Top', 'Jungle', 'Mid', 'Dragon', 'Support'];

export const DEFAULT_RANK_BRACKET: RankBracket = 'diamond_plus';

/** Win rate is primary; pick/ban add contested-pick pressure. */
export function championTierScore(winRate: number, pickRate: number, banRate: number): number {
  return winRate + 0.15 * pickRate + 0.1 * banRate;
}

export interface TierBandCounts {
  S: number;
  A: number;
  B: number;
  C: number;
}

/** Relative S/A/B/C sizes for a lane: ~10% / 20% / 40% / remainder. */
export function tierBandCounts(n: number): TierBandCounts {
  if (n <= 0) {
    return { S: 0, A: 0, B: 0, C: 0 };
  }
  const s = Math.max(1, Math.round(n * 0.1));
  const a = Math.round(n * 0.2);
  const b = Math.round(n * 0.4);
  let counts: TierBandCounts = { S: s, A: a, B: b, C: n - s - a - b };
  for (const letter of ['B', 'A', 'S'] as const) {
    while (counts.C < 0 && counts[letter] > 0) {
      counts = { ...counts, [letter]: counts[letter] - 1, C: counts.C + 1 };
    }
  }
  if (counts.C < 0) {
    counts = { ...counts, C: 0 };
  }
  return counts;
}

export function assignTierLetter(rankInLane: number, counts: TierBandCounts): TierLetter {
  if (rankInLane <= counts.S) {
    return 'S';
  }
  if (rankInLane <= counts.S + counts.A) {
    return 'A';
  }
  if (rankInLane <= counts.S + counts.A + counts.B) {
    return 'B';
  }
  return 'C';
}

export interface PatchAnalysisWatch {
  slug: string;
  why: string;
}

export interface PatchAnalysisMover {
  slug: string;
  direction: 'up' | 'down';
  note: string;
}

/** Stored LLM commentary. Letter grades are never part of this payload. */
export interface PatchAnalysisPayload {
  lede: string;
  watch: PatchAnalysisWatch[];
  movers: PatchAnalysisMover[];
}

export {
  buildLaneCounters,
  counterScore,
  formatWinRate,
  matchupVerdict,
  pickEnemyLane,
  type AlsoPickResult,
  type CounterPickResult,
  type LaneStatRow,
  type MatchupSide,
} from './counters';
export {
  banLift,
  compGaps,
  compNeeds,
  draftFitScore,
  rankDraftSuggestions,
  traitCoverage,
  traitsForRoles,
  type CompNeed,
  type CompStatus,
  type CompTrait,
  type DraftContext,
  type DraftPlacement,
  type DraftSuggestion,
} from './draft';

/** One ability from a champion's kit (passive / 1 / 2 / 3 / ultimate). */
export interface ChampionAbility {
  /** Kit slot key, e.g. "passive", "1", "ultimate". */
  slot: AbilitySlot;
  /** Display name, e.g. "Deathbringer Stance". */
  name: string;
  /** Plain-text description from the champion page. */
  description: string | null;
  /** Ability icon URL (Riot CDN). */
  iconUrl: string | null;
  /** Ability preview video URL when present. */
  videoUrl: string | null;
  /** Display order within the kit (0 = passive). */
  sortOrder: number;
}
