export { getPool, closePool, type DbClient } from './client';
export {
  insertRawSource,
  type RawSourceInput,
} from './raw-sources';
export {
  getPatchByVersion,
  getLatestPatch,
  insertPatchWithChanges,
  type StoredPatch,
} from './patches';
export {
  upsertChampion,
  updateChampionImageAsset,
  listChampions,
  getChampionBySlug,
  listChampionsNeedingAssetSync,
  type StoredChampion,
  type ChampionImageAsset,
} from './champions';
