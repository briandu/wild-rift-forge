export { getPool, closePool, type DbClient } from './client';
export {
  insertRawSource,
  type RawSourceInput,
} from './raw-sources';
export {
  getPatchByVersion,
  getLatestPatch,
  insertPatchWithChanges,
  listPatchChanges,
  getPatchAnalysis,
  upsertPatchAnalysis,
  type StoredPatch,
  type StoredPatchChange,
  type StoredPatchAnalysis,
} from './patches';
export {
  insertStatSnapshots,
  listSnapshotsForDate,
  listSnapshotsForDateAllBrackets,
  listSnapshotDates,
  getLatestSnapshotDate,
  getPreviousSnapshotDate,
  replaceTierPlacements,
  listPlacementsForDate,
  listLatestTierPlacements,
  listWinRatesByChampion,
  listLatestLaneStats,
  type LaneStatSnapshot,
  type StatSnapshotInput,
  type StoredStatSnapshot,
  type TierPlacementInput,
  type StoredTierPlacement,
} from './stats';
export {
  upsertChampion,
  updateChampionImageAsset,
  updateChampionThumbnailSource,
  updateChampionThumbnailAsset,
  listChampions,
  getChampionBySlug,
  listChampionsNeedingAssetSync,
  listChampionsNeedingThumbnailSync,
  type StoredChampion,
  type ChampionImageAsset,
} from './champions';
export {
  replaceChampionAbilities,
  listChampionAbilities,
  listAbilitiesBySlug,
  upsertChampionAbilityGameplay,
  type ChampionAbilityGameplay,
  type StoredChampionAbility,
} from './champion-abilities';
export {
  listIconSignatures,
  listChampionsNeedingSignature,
  upsertIconSignature,
  type IconSignatureInput,
  type IconSignatureVariant,
  type StoredIconSignature,
} from './icon-signatures';
export {
  listTierExplanations,
  upsertTierExplanations,
  type StoredTierExplanation,
  type TierExplanationInput,
} from './tier-explanations';
export {
  listTierAdjustments,
  replaceTierAdjustments,
  type StoredTierAdjustment,
  type TierAdjustmentInput,
} from './tier-adjustments';
export {
  getMatchupGuide,
  upsertMatchupGuide,
  requestMatchupGuide,
  listPendingMatchupRequests,
  markMatchupRequestGenerated,
  countInFlightMatchupGenerations,
  claimMatchupGuideRequest,
  releaseMatchupGuideClaim,
  tryReserveMatchupGenerationCall,
  type MatchupGuideContent,
  type MatchupGuideInput,
  type MatchupGuidePhase,
  type MatchupGuideRequest,
  type MatchupGuideTrades,
  type MatchupGenerationReserve,
  type StoredMatchupGuide,
} from './matchup-guides';
