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
  type StoredChampionAbility,
} from './champion-abilities';
