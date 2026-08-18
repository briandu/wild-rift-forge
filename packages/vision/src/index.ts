/**
 * Champion-select recognition primitives.
 *
 * Pure and DOM-free on purpose: the browser turns a captured video frame into a
 * {@link Bitmap} and everything from there is deterministic and unit-testable.
 * No model inference happens in this package — matching is a 64-bit perceptual
 * hash lookup, which is what keeps a capture under the champion-select timer.
 */

export {
  centerCrop,
  contentFrame,
  createBitmap,
  cropBitmap,
  findContentBounds,
  meanColor,
  resizeGray,
  setPixel,
  toGray,
  toNormalizedRect,
  toPixelRect,
  type Bitmap,
  type GrayImage,
  type NormalizedRect,
  type PixelData,
  type Rect,
} from './bitmap';

export {
  colorDistance,
  colorSignature,
  dhash,
  hamming,
  HASH_ALGO,
  ICON_INSET,
  isColorSignature,
  isHash64,
  type ColorSignature,
  type Hash64,
} from './hash';

export {
  DEFAULT_ACCEPT_CONFIDENCE,
  matchTile,
  type IconReference,
  type IconVariant,
  type MatchTileOptions,
  type TileMatch,
  type TileMatchResult,
} from './match';

export {
  aspectKey,
  BANS_PER_TEAM,
  BAN_TRAY_MAX_Y,
  calibrateLayout,
  CENTER_BAND,
  brighterColumns,
  detectHighlightedRow,
  locateBanTrays,
  locatePortraitColumns,
  refinePortraitColumns,
  parseSlotKey,
  refineRegion,
  shiftCompanionRegions,
  withMeasuredRegions,
  SEED_PARAMS,
  SEED_PARAMS_PHONE,
  seedLayoutProfile,
  seedParamsFor,
  slotKey,
  TEAM_SLOTS,
  type CalibrateOptions,
  type HighlightRead,
  type IconHit,
  type LayoutProfile,
  type LayoutRegion,
  type RefineOptions,
  type SeedLayoutParams,
  type SlotKey,
  type SlotRole,
} from './layout';

export {
  DRAFT_LANES,
  inferMissingLanes,
  isLockedPick,
  isLockedPortrait,
  LANE_TEMPLATES,
  laneIndex,
  mergeRowLanes,
  readLaneLabel,
  type DraftLane,
  type LaneTemplate,
} from './lanes';

export {
  detectPhase,
  isAvatarPhase,
  MATCH_MODAL,
  PHASE_HEADER,
  PHASE_TEMPLATES,
  phaseLabel,
  readHudTitle,
  type DetectPhaseOptions,
  type DraftPhase,
  type HudTitle,
  type PhaseTemplate,
} from './phase';

export { CAPTURED_ICONS } from './captured-icons';

export { readDraft, type DraftRead, type ReadDraftOptions, type SlotRead } from './read';
