/**
 * Champion-select geometry.
 *
 * Measured against `design/reference/champ-select-banning-16x9.png`, a real Wild
 * Rift champion-select frame. The layout is:
 *
 *   - Five circular player portraits hugging the left edge (your team).
 *   - Five circular player portraits hugging the right edge (the enemy team).
 *   - A ban tray in each top corner, five slots per team.
 *   - The local player's row is highlighted gold.
 *   - A 5x4 champion grid fills the centre. That is the *picker*, not draft state,
 *     so every region and scan here deliberately avoids the central band.
 *
 * The reference frame predates the current five-ban format and shows only three
 * tray slots per side, so the ban tray spacing below is a structural placeholder
 * pending a current screenshot. Row and portrait geometry is unaffected.
 *
 * Seed numbers are approximate by design: they only need to land close enough for
 * a calibration pass to lock on, after which the refined rects are persisted.
 */

import {
  cropBitmap,
  meanColor,
  toNormalizedRect,
  toPixelRect,
  type Bitmap,
  type NormalizedRect,
  type Rect,
} from './bitmap';
import { colorSignature, dhash } from './hash';
import { matchTile, type IconReference } from './match';

export type SlotRole = 'ally' | 'enemy' | 'ban-ally' | 'ban-enemy';

export type SlotKey = string;

export const TEAM_SLOTS = 5;

/** Bans per team, so a full draft removes ten champions from the pool. */
export const BANS_PER_TEAM = 5;

export function slotKey(role: SlotRole, index: number): SlotKey {
  return `${role}-${index}`;
}

export function parseSlotKey(key: SlotKey): { role: SlotRole; index: number } | null {
  const match = /^(ban-ally|ban-enemy|ally|enemy)-(\d+)$/.exec(key);
  if (!match) return null;
  return { role: match[1] as SlotRole, index: Number(match[2]) };
}

export type LayoutRegion = {
  key: SlotKey;
  role: SlotRole;
  index: number;
  rect: NormalizedRect;
};

export type LayoutProfile = {
  /** Aspect ratio label such as "16:9", used to pick a profile per device. */
  aspectKey: string;
  regions: LayoutRegion[];
  /** Row strips sampled to find the gold highlight on the local player. */
  highlightRegions: LayoutRegion[];
  source: 'seed' | 'calibrated';
};

/** Portrait columns sit outside this central band; the champion grid sits inside it. */
export const CENTER_BAND = { min: 0.2, max: 0.8 };

/** Ban trays live above this line. */
export const BAN_TRAY_MAX_Y = 0.14;

export function aspectKey(width: number, height: number): string {
  if (height <= 0) return 'unknown';
  const ratio = width / height;
  const known: Array<[string, number]> = [
    ['4:3', 4 / 3],
    ['3:2', 3 / 2],
    ['16:10', 16 / 10],
    ['16:9', 16 / 9],
    ['18:9', 2],
    ['19.5:9', 19.5 / 9],
    ['20:9', 20 / 9],
    ['21:9', 21 / 9],
  ];
  let bestLabel = 'unknown';
  let bestGap = Number.POSITIVE_INFINITY;
  for (const [label, value] of known) {
    const gap = Math.abs(ratio - value);
    if (gap < bestGap) {
      bestGap = gap;
      bestLabel = label;
    }
  }
  return bestGap <= 0.08 ? bestLabel : `${ratio.toFixed(2)}:1`;
}

export type SeedLayoutParams = {
  /** Vertical centre of the first player row, as a fraction of frame height. */
  firstRowCenterY: number;
  /** Vertical gap between player rows. */
  rowStepY: number;
  /** Portrait height as a fraction of frame height. */
  iconHeight: number;
  /** Horizontal centre of the ally portrait column. */
  allyCenterX: number;
  /** Horizontal centre of the enemy portrait column. */
  enemyCenterX: number;
  /** Vertical centre of both ban trays. */
  banCenterY: number;
  /** Ban icon height as a fraction of frame height. */
  banHeight: number;
  /** Horizontal centre of the first (outermost) ban slot on each side. */
  banFirstCenterX: number;
  /** Horizontal gap between ban slots, moving inward. */
  banStepX: number;
  /** Ban slots per team. */
  bansPerTeam: number;
};

/** Approximations read off the 16:9 reference frame. */
export const SEED_PARAMS: SeedLayoutParams = {
  firstRowCenterY: 0.212,
  rowStepY: 0.133,
  iconHeight: 0.095,
  allyCenterX: 0.034,
  enemyCenterX: 0.959,
  banCenterY: 0.049,
  banHeight: 0.072,
  banFirstCenterX: 0.034,
  banStepX: 0.045,
  bansPerTeam: BANS_PER_TEAM,
};

function squareRect(
  centerX: number,
  centerY: number,
  heightFraction: number,
  aspect: number,
): NormalizedRect {
  // Normalized width must shrink by the aspect ratio for the region to be square in pixels.
  const widthFraction = heightFraction / aspect;
  return {
    x: centerX - widthFraction / 2,
    y: centerY - heightFraction / 2,
    width: widthFraction,
    height: heightFraction,
  };
}

/**
 * Build a starting layout for a frame of the given size. Calibration replaces this
 * with measured rects, but a seed lets the very first capture work.
 */
export function seedLayoutProfile(
  width: number,
  height: number,
  params: SeedLayoutParams = SEED_PARAMS,
): LayoutProfile {
  const aspect = width / height;
  const regions: LayoutRegion[] = [];
  const highlightRegions: LayoutRegion[] = [];

  for (let index = 0; index < TEAM_SLOTS; index += 1) {
    const centerY = params.firstRowCenterY + params.rowStepY * index;
    regions.push({
      key: slotKey('ally', index),
      role: 'ally',
      index,
      rect: squareRect(params.allyCenterX, centerY, params.iconHeight, aspect),
    });
    regions.push({
      key: slotKey('enemy', index),
      role: 'enemy',
      index,
      rect: squareRect(params.enemyCenterX, centerY, params.iconHeight, aspect),
    });
    // The gold highlight covers the whole row band, so sample the text area beside
    // the portrait where no champion art can bias the colour.
    highlightRegions.push({
      key: slotKey('ally', index),
      role: 'ally',
      index,
      rect: {
        x: 0.075,
        y: centerY - params.rowStepY * 0.32,
        width: 0.11,
        height: params.rowStepY * 0.64,
      },
    });
  }

  for (let index = 0; index < params.bansPerTeam; index += 1) {
    regions.push({
      key: slotKey('ban-ally', index),
      role: 'ban-ally',
      index,
      rect: squareRect(
        params.banFirstCenterX + params.banStepX * index,
        params.banCenterY,
        params.banHeight,
        aspect,
      ),
    });
    regions.push({
      key: slotKey('ban-enemy', index),
      role: 'ban-enemy',
      index,
      rect: squareRect(
        1 - params.banFirstCenterX - params.banStepX * index,
        params.banCenterY,
        params.banHeight,
        aspect,
      ),
    });
  }

  return { aspectKey: aspectKey(width, height), regions, highlightRegions, source: 'seed' };
}

export type HighlightRead = {
  index: number;
  /** Yellow-ness of the winning row. */
  score: number;
  /** Gap to the next-most-yellow row. Small gaps mean the read is unreliable. */
  margin: number;
};

/** Minimum yellow-ness and separation before the highlight read is trusted. */
const HIGHLIGHT_MIN_SCORE = 18;
const HIGHLIGHT_MIN_MARGIN = 8;

/**
 * Find which ally row the game is highlighting, which is the local player's slot.
 * Wild Rift paints that row gold, so the row with the strongest warm cast wins.
 */
export function detectHighlightedRow(
  bitmap: Bitmap,
  regions: readonly LayoutRegion[],
): HighlightRead | null {
  const scores = regions
    .filter((region) => region.role === 'ally')
    .map((region) => {
      const { r, g, b } = meanColor(bitmap, toPixelRect(region.rect, bitmap.width, bitmap.height));
      return { index: region.index, score: (r + g) / 2 - b };
    })
    .sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (!best) return null;
  const margin = best.score - (scores[1]?.score ?? best.score);
  if (best.score < HIGHLIGHT_MIN_SCORE || margin < HIGHLIGHT_MIN_MARGIN) return null;
  return { index: best.index, score: best.score, margin };
}

export type IconHit = {
  rect: Rect;
  slug: string;
  confidence: number;
};

export type RefineOptions = {
  /** How far to search, as a fraction of the seed size. */
  searchRatio?: number;
  /** Size multipliers to try around the seed size. */
  scales?: number[];
  acceptConfidence?: number;
};

/** Default scale sweep, covering a portrait rendered up to ~15% off the seed size. */
const REFINE_SCALES = [0.85, 0.925, 1, 1.075, 1.15];

/**
 * Search a window of offsets and sizes for the alignment that matches best.
 * Colour is skipped here because it costs as much as the hash and cannot change
 * which alignment wins; the winner is re-scored with colour by the caller.
 */
function searchAlignment(
  bitmap: Bitmap,
  seedRect: Rect,
  references: readonly IconReference[],
  sizes: readonly number[],
  center: { x: number; y: number },
  span: number,
  step: number,
): IconHit | null {
  let best: IconHit | null = null;
  for (const size of sizes) {
    if (size < 8) continue;
    for (let dy = -span; dy <= span; dy += step) {
      for (let dx = -span; dx <= span; dx += step) {
        const rect: Rect = {
          x: center.x + dx - Math.round((size - seedRect.width) / 2),
          y: center.y + dy - Math.round((size - seedRect.height) / 2),
          width: size,
          height: size,
        };
        if (rect.x < 0 || rect.y < 0) continue;
        if (rect.x + rect.width > bitmap.width || rect.y + rect.height > bitmap.height) continue;
        const tile = cropBitmap(bitmap, rect);
        const result = matchTile(dhash(tile), undefined, references, { acceptConfidence: 0 });
        if (result.best && (!best || result.best.confidence > best.confidence)) {
          best = { rect, slug: result.best.slug, confidence: result.best.confidence };
        }
      }
    }
  }
  return best;
}

/**
 * Find the exact alignment of a portrait near its expected position.
 *
 * Perceptual hashes are alignment-sensitive: a tile offset by even 15% of its width
 * hashes very differently, so a blind sliding-window search over the whole frame
 * would need a step fine enough to be unusably slow. The seed layout already puts
 * every region within a few percent of the truth, so this does a coarse local sweep
 * and then a fine sweep around the winner — accurate to a pixel or two while
 * evaluating a fraction of the windows a single fine pass would need.
 */
export function refineRegion(
  bitmap: Bitmap,
  seedRect: Rect,
  references: readonly IconReference[],
  options: RefineOptions = {},
): IconHit | null {
  const { searchRatio = 0.4, scales = REFINE_SCALES, acceptConfidence = 0.6 } = options;
  const baseSize = Math.max(seedRect.width, seedRect.height);
  if (baseSize < 8 || references.length === 0) return null;

  const sizes = scales.map((scale) => Math.round(baseSize * scale));
  const coarse = searchAlignment(
    bitmap,
    seedRect,
    references,
    sizes,
    { x: seedRect.x, y: seedRect.y },
    Math.round(baseSize * searchRatio),
    Math.max(2, Math.round(baseSize * 0.16)),
  );
  if (!coarse) return null;

  // Re-centre on the coarse winner and sweep only its own size, at pixel precision.
  const fine =
    searchAlignment(
      bitmap,
      { ...seedRect, width: coarse.rect.width, height: coarse.rect.height },
      references,
      [coarse.rect.width],
      { x: coarse.rect.x, y: coarse.rect.y },
      Math.max(2, Math.round(baseSize * 0.16)),
      Math.max(1, Math.round(baseSize * 0.04)),
    ) ?? coarse;

  const winner = cropBitmap(bitmap, fine.rect);
  const confirmed = matchTile(dhash(winner), colorSignature(winner), references, {
    acceptConfidence,
  });
  if (!confirmed.accepted || !confirmed.best) return null;
  return { rect: fine.rect, slug: confirmed.best.slug, confidence: confirmed.best.confidence };
}

export type CalibrateOptions = RefineOptions & {
  /** Start from this profile instead of the seed, e.g. to re-tune a saved one. */
  profile?: LayoutProfile;
};

/**
 * Lock the layout onto a real frame.
 *
 * Every region is refined independently and any slot that cannot be resolved keeps
 * its seed rect. That is the normal case during the ban phase, when most portraits
 * are still empty, so a partial calibration is still worth saving.
 */
export function calibrateLayout(
  bitmap: Bitmap,
  references: readonly IconReference[],
  options: CalibrateOptions = {},
): { profile: LayoutProfile; hits: Map<SlotKey, IconHit> } {
  const seed = options.profile ?? seedLayoutProfile(bitmap.width, bitmap.height);
  const hits = new Map<SlotKey, IconHit>();

  const regions = seed.regions.map((region) => {
    const seedRect = toPixelRect(region.rect, bitmap.width, bitmap.height);
    const hit = refineRegion(bitmap, seedRect, references, options);
    if (!hit) return region;
    hits.set(region.key, hit);
    return {
      ...region,
      rect: toNormalizedRect(hit.rect, bitmap.width, bitmap.height),
    };
  });

  return {
    profile: {
      ...seed,
      regions,
      source: hits.size > 0 ? 'calibrated' : seed.source,
    },
    hits,
  };
}
