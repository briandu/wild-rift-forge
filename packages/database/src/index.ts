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
  insertPatchAnalysis,
  type StoredPatch,
  type StoredPatchChange,
  type StoredPatchAnalysis,
} from './patches';
export {
  insertStatSnapshots,
  listSnapshotsForDate,
  getLatestSnapshotDate,
  getPreviousSnapshotDate,
  replaceTierPlacements,
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
