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

export {
  matchAbilityByName,
  normalizeAbilityName,
  patchAbilityKey,
  type NamedAbility,
} from './abilities';

export {
  adjustmentKey,
  applyLetterAdjustment,
  assignTierLetter,
  assignTierLetterHybrid,
  assignTierLetterWithHysteresis,
  championTierScore,
  compositeTierScore,
  daysSincePatch,
  DEFAULT_RANK_BRACKET,
  DEFAULT_TIER_RULESET,
  HYSTERESIS_MARGIN,
  PATCH_NUDGE_CAP,
  PATCH_NUDGE_DECAY_DAYS,
  patchChangeSign,
  patchNudge,
  SHRINKAGE_K,
  SKILL_SPREAD_CAP,
  SKILL_SPREAD_WEIGHT,
  shrinkWinRate,
  skillSpread,
  skillSpreadAdjustment,
  TIER_LANES,
  TIER_LETTERS,
  TIER_RULESET_BLENDED,
  TIER_RULESET_CN,
  TIER_SCORE_FLOORS,
  tierBandCounts,
  type CompositeTierScore,
  type CompositeTierScoreInput,
  type RankBracket,
  type TierBandCounts,
  type TierLane,
  type TierLetter,
  type TierRuleset,
} from './tiers';

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
export {
  DAMAGE_TYPES,
  EFFECT_TYPES,
  GAP_KINDS,
  PARSE_CONFIDENCE,
  RESOURCE_TYPES,
  SCALING_STATS,
  WRF_ABILITY_SLOTS,
  abilityCostSchema as wrfAbilityCostSchema,
  abilityEffectSchema,
  wrfAbilitySchema,
  wrfChampionSchema,
  wrfChampionStatsSchema,
  wrfIndexEntrySchema,
  wrfSourceSchema,
  type AbilityEffect,
  type AbilityScaling,
  type AbilityState,
  type ChampionResource,
  type DamageType,
  type EffectType,
  type GapKind,
  type ParseConfidence,
  type ParseGap,
  type RankValue,
  type ResourceType,
  type ScalingStat,
  type WrfAbility,
  type WrfAbilityCost,
  type WrfAbilitySlot,
  type WrfChampion,
  type WrfChampionStats,
  type WrfIndexEntry,
  type WrfSource,
} from './wrf-champion';
export {
  championIdsMatch,
  compactChampionId,
  DB_SLOT_BY_BASELINE,
  pickBaselineAbilityForSlot,
  slugFromOfficialUrl,
  SORT_ORDER_BY_BASELINE,
} from './snapshot';

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
