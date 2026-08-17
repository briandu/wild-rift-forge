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
 * pending a current undistorted screenshot. Row and portrait geometry is unaffected.
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
  /** Text beside each ally portrait: lane name until the pick locks. */
  laneLabelRegions: LayoutRegion[];
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
  /** Left edge of the gold-row / lane-label strip beside ally portraits. */
  highlightX: number;
  highlightWidth: number;
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
  highlightX: 0.075,
  highlightWidth: 0.11,
};

/**
 * iPhone / tall-phone champion select. Measured from undistorted 19.5:9 ranked
 * stills: the notch pushes the ally column inward, so the 16:9 seed samples
 * empty chrome and the matcher invents picks from the centre grid.
 */
export const SEED_PARAMS_PHONE: SeedLayoutParams = {
  firstRowCenterY: 0.191,
  rowStepY: 0.136,
  iconHeight: 0.105,
  allyCenterX: 0.14,
  enemyCenterX: 0.884,
  banCenterY: 0.052,
  banHeight: 0.063,
  banFirstCenterX: 0.099,
  banStepX: 0.036,
  bansPerTeam: BANS_PER_TEAM,
  highlightX: 0.175,
  highlightWidth: 0.14,
};

const PHONE_ASPECTS = new Set(['18:9', '19.5:9', '20:9', '21:9']);

export function seedParamsFor(width: number, height: number): SeedLayoutParams {
  return PHONE_ASPECTS.has(aspectKey(width, height)) ? SEED_PARAMS_PHONE : SEED_PARAMS;
}

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
  params: SeedLayoutParams = seedParamsFor(width, height),
): LayoutProfile {
  const aspect = width / height;
  const regions: LayoutRegion[] = [];
  const highlightRegions: LayoutRegion[] = [];
  const laneLabelRegions: LayoutRegion[] = [];

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
        x: params.highlightX,
        y: centerY - params.rowStepY * 0.32,
        width: params.highlightWidth,
        height: params.rowStepY * 0.64,
      },
    });
    // Only the upper line (`BARON LANE`); the player name sits underneath.
    laneLabelRegions.push({
      key: slotKey('ally', index),
      role: 'ally',
      index,
      rect: {
        x: params.highlightX,
        y: centerY - params.rowStepY * 0.28,
        width: params.highlightWidth,
        height: params.rowStepY * 0.32,
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
        1 -
          params.banFirstCenterX -
          params.banStepX * (params.bansPerTeam - 1) +
          params.banStepX * index,
        params.banCenterY,
        params.banHeight,
        aspect,
      ),
    });
  }

  return {
    aspectKey: aspectKey(width, height),
    regions,
    highlightRegions,
    laneLabelRegions,
    source: 'seed',
  };
}

/** Tray search window: the top slice of the frame and the outer edge of each side. */
const BAN_BAND_MAX_Y = 0.16;
const BAN_SIDE_SPAN = 0.32;
/** Two visible bans are enough to solve for spacing; one leaves the anchor ambiguous. */
const BAN_MIN_VISIBLE = 2;

function lumaAt(bitmap: Bitmap, x: number, y: number): number {
  const offset = (y * bitmap.width + x) * 4;
  return (
    0.299 * (bitmap.data[offset] ?? 0) +
    0.587 * (bitmap.data[offset + 1] ?? 0) +
    0.114 * (bitmap.data[offset + 2] ?? 0)
  );
}

/** Contiguous spans where `values` stays at or above `min`, ignoring spans shorter than `minRun`. */
function spans(values: readonly number[], min: number, minRun: number) {
  const out: Array<{ start: number; end: number }> = [];
  let start = -1;
  for (let index = 0; index <= values.length; index += 1) {
    const inside = index < values.length && (values[index] ?? 0) >= min;
    if (inside && start < 0) start = index;
    if (!inside && start >= 0) {
      if (index - start >= minRun) out.push({ start, end: index });
      start = -1;
    }
  }
  return out;
}

/** The horizontal band both ban trays sit in, found from the bright champion art in them. */
function findBanBand(bitmap: Bitmap): { start: number; end: number } | null {
  const maxY = Math.round(bitmap.height * BAN_BAND_MAX_Y);
  const span = Math.round(bitmap.width * BAN_SIDE_SPAN);
  if (maxY < 6 || span < 20) return null;

  const brightness: number[] = [];
  for (let y = 0; y < maxY; y += 1) {
    let bright = 0;
    for (let x = 0; x < span; x += 1) {
      if (lumaAt(bitmap, x, y) > 45) bright += 1;
      if (lumaAt(bitmap, bitmap.width - 1 - x, y) > 45) bright += 1;
    }
    brightness.push(bright / (span * 2));
  }

  // Champion art makes the tray far brighter than any chrome above or below it, so
  // a threshold relative to the peak isolates it without tuning per capture source.
  const peak = Math.max(...brightness);
  if (peak < 0.025) return null;
  const candidates = spans(
    brightness,
    Math.max(0.025, peak * 0.5),
    Math.max(4, Math.round(bitmap.height * 0.02)),
  );
  const band = candidates.sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  if (!band) return null;
  // A band too short to hold a ban icon means no ban art is on screen yet, and the
  // brightest row is some other chrome. Better to keep the seed than fit noise.
  const height = band.end - band.start;
  return height >= bitmap.height * 0.04 && height <= bitmap.height * 0.12 ? band : null;
}

/** Minimum contrast, in luma, between slot interiors and the gutters between them. */
const BAN_MIN_CONTRAST = 6;

/**
 * Locate one tray by fitting the shape we already know it has.
 *
 * A tray is always five equal squares on one pitch, so instead of thresholding
 * tiles out of the frame — which fails whenever a slot is empty, dim, or brighter
 * than a neighbouring gutter — this sweeps every plausible (offset, pitch) and
 * keeps the one whose slot interiors are brightest relative to its gutters.
 */
function trayRects(
  bitmap: Bitmap,
  band: { start: number; end: number },
  side: 'ally' | 'enemy',
): Rect[] | null {
  const span = Math.round(bitmap.width * BAN_SIDE_SPAN);
  const x0 = side === 'ally' ? 0 : bitmap.width - span;
  const height = band.end - band.start;
  if (height < 8) return null;

  const prefix = new Float64Array(span + 1);
  for (let column = 0; column < span; column += 1) {
    let total = 0;
    for (let y = band.start; y < band.end; y += 1) total += lumaAt(bitmap, x0 + column, y);
    prefix[column + 1] = prefix[column]! + total / height;
  }
  const mean = (from: number, to: number) =>
    to > from ? (prefix[to]! - prefix[from]!) / (to - from) : 0;

  let best: { score: number; anchor: number; pitch: number; size: number } | null = null;
  for (let pitch = height * 0.9; pitch <= height * 1.9; pitch += 0.25) {
    for (const gutterRatio of [0.72, 0.8, 0.88]) {
      const size = pitch * gutterRatio;
      if (size < height * 0.7 || size > height * 1.25) continue;
      const width = pitch * (BANS_PER_TEAM - 1) + size;
      for (let anchor = 0; anchor + width <= span; anchor += 1) {
        let slots = 0;
        let gutters = 0;
        for (let index = 0; index < BANS_PER_TEAM; index += 1) {
          const left = Math.round(anchor + pitch * index);
          slots += mean(left, Math.round(left + size));
          if (index > 0) gutters += mean(Math.round(anchor + pitch * index - (pitch - size)), left);
        }
        const score = slots / BANS_PER_TEAM - gutters / (BANS_PER_TEAM - 1);
        if (!best || score > best.score) best = { score, anchor, pitch, size };
      }
    }
  }
  if (!best || best.score < BAN_MIN_CONTRAST) return null;

  const size = Math.round(best.size);
  // A tight band already is the icons. A taller one includes the red glow
  // under the tray — pin the square to the brightest row so we do not hash
  // that glow as if it were a face.
  let top = band.start;
  if (band.end - band.start > size * 1.15) {
    let weight = 0;
    let moment = 0;
    for (let y = band.start; y < band.end; y += 1) {
      let row = 0;
      for (let column = 0; column < span; column += 1) row += lumaAt(bitmap, x0 + column, y);
      weight += row;
      moment += row * y;
    }
    const centerY = weight > 0 ? moment / weight : (band.start + band.end) / 2;
    top = Math.round(centerY - size / 2);
  }
  if (top < 0 || top + size > bitmap.height) return null;

  const rects: Rect[] = [];
  for (let index = 0; index < BANS_PER_TEAM; index += 1) {
    const left = Math.round(x0 + best.anchor + best.pitch * index);
    if (left < 0 || left + size > bitmap.width) return null;
    rects.push({ x: left, y: top, width: size, height: size });
  }
  // Index 0 is the leftmost slot on both trays, matching how the HUD is read.
  return rects;
}

/**
 * Measure both ban trays directly from a frame.
 *
 * The trays move and rescale between devices and capture pipelines, and a seed
 * that is off by even one slot width reads the wrong champion into every ban.
 * Measuring them per frame keeps bans correct without a device-specific profile.
 */
export function locateBanTrays(bitmap: Bitmap): LayoutRegion[] | null {
  const band = findBanBand(bitmap);
  if (!band) return null;

  const regions: LayoutRegion[] = [];
  for (const side of ['ally', 'enemy'] as const) {
    const rects = trayRects(bitmap, band, side);
    if (!rects) continue;
    const role: SlotRole = side === 'ally' ? 'ban-ally' : 'ban-enemy';
    rects.forEach((rect, index) => {
      regions.push({
        key: slotKey(role, index),
        role,
        index,
        rect: toNormalizedRect(rect, bitmap.width, bitmap.height),
      });
    });
  }
  return regions.length ? regions : null;
}

/** Portrait columns sit below the ban tray and outside the champion grid. */
const COLUMN_MIN_Y = 0.12;
const COLUMN_MAX_Y = 0.86;
const COLUMN_SIDE_SPAN = 0.18;
const COLUMN_MIN_CONTRAST = 6;

/**
 * Locate the five stacked portraits on one side by the same interior-vs-gutter
 * fit used for ban trays, then slide each square onto the brightest column in
 * that row so a 16:9 seed does not sit in the letterbox while the phone
 * portraits sit further in.
 */
function columnRects(bitmap: Bitmap, side: 'ally' | 'enemy'): Rect[] | null {
  const span = Math.round(bitmap.width * COLUMN_SIDE_SPAN);
  const x0 = side === 'ally' ? 0 : bitmap.width - span;
  const y0 = Math.round(bitmap.height * COLUMN_MIN_Y);
  const y1 = Math.round(bitmap.height * COLUMN_MAX_Y);
  const rows = y1 - y0;
  if (span < 16 || rows < 40) return null;

  const prefix = new Float64Array(rows + 1);
  for (let row = 0; row < rows; row += 1) {
    let total = 0;
    for (let x = x0; x < x0 + span; x += 1) total += lumaAt(bitmap, x, y0 + row);
    prefix[row + 1] = prefix[row]! + total / span;
  }
  const mean = (from: number, to: number) =>
    to > from ? (prefix[to]! - prefix[from]!) / (to - from) : 0;

  let best: { score: number; anchor: number; pitch: number; size: number } | null = null;
  const minPitch = rows / TEAM_SLOTS / 1.35;
  const maxPitch = rows / TEAM_SLOTS / 0.75;
  for (let pitch = minPitch; pitch <= maxPitch; pitch += 0.5) {
    for (const gutterRatio of [0.68, 0.76, 0.84]) {
      const size = pitch * gutterRatio;
      if (size < rows * 0.08 || size > rows * 0.22) continue;
      const height = pitch * (TEAM_SLOTS - 1) + size;
      for (let anchor = 0; anchor + height <= rows; anchor += 1) {
        let slots = 0;
        let gutters = 0;
        for (let index = 0; index < TEAM_SLOTS; index += 1) {
          const top = Math.round(anchor + pitch * index);
          slots += mean(top, Math.round(top + size));
          if (index > 0) {
            gutters += mean(Math.round(anchor + pitch * index - (pitch - size)), top);
          }
        }
        const score = slots / TEAM_SLOTS - gutters / (TEAM_SLOTS - 1);
        if (!best || score > best.score) best = { score, anchor, pitch, size };
      }
    }
  }
  if (!best || best.score < COLUMN_MIN_CONTRAST) return null;

  const size = Math.round(best.size);
  const rects: Rect[] = [];
  for (let index = 0; index < TEAM_SLOTS; index += 1) {
    const top = Math.round(y0 + best.anchor + best.pitch * index);
    let weight = 0;
    let moment = 0;
    for (let x = 0; x < span; x += 1) {
      let column = 0;
      for (let y = top; y < top + size && y < bitmap.height; y += 1) {
        column += lumaAt(bitmap, x0 + x, y);
      }
      weight += column;
      moment += column * x;
    }
    const centerX = x0 + (weight > 0 ? moment / weight : span / 2);
    const left = Math.round(centerX - size / 2);
    if (left < 0 || top < 0 || left + size > bitmap.width || top + size > bitmap.height) {
      return null;
    }
    rects.push({ x: left, y: top, width: size, height: size });
  }
  return rects;
}

/**
 * Measure both player columns directly from a frame.
 *
 * Seed X values jump from 0.03 on 16:9 to 0.14 on a phone. A shared window that
 * is 16:9 with the game letterboxed inside keeps the 16:9 seed, so the overlay
 * and the matcher both sit in the black bar. Measuring the columns from the
 * portraits themselves keeps them on the faces.
 */
export function locatePortraitColumns(bitmap: Bitmap): LayoutRegion[] | null {
  const regions: LayoutRegion[] = [];
  for (const side of ['ally', 'enemy'] as const) {
    const rects = columnRects(bitmap, side);
    if (!rects) continue;
    rects.forEach((rect, index) => {
      regions.push({
        key: slotKey(side, index),
        role: side,
        index,
        rect: toNormalizedRect(rect, bitmap.width, bitmap.height),
      });
    });
  }
  return regions.length ? regions : null;
}

/** Keep lane-label and gold-row strips glued to the measured ally portraits. */
export function shiftCompanionRegions(
  profile: LayoutProfile,
  columns: readonly LayoutRegion[],
): LayoutProfile {
  const allies = columns.filter((region) => region.role === 'ally');
  if (allies.length === 0) return profile;

  const byIndex = new Map(allies.map((region) => [region.index, region]));
  const move = (region: LayoutRegion): LayoutRegion => {
    const ally = byIndex.get(region.index);
    if (!ally) return region;
    return {
      ...region,
      rect: {
        ...region.rect,
        x: ally.rect.x + ally.rect.width + 0.008,
        y: ally.rect.y + ally.rect.height * 0.08,
        height: ally.rect.height * 0.55,
      },
    };
  };

  return {
    ...profile,
    highlightRegions: profile.highlightRegions.map(move),
    laneLabelRegions: profile.laneLabelRegions.map(move),
  };
}

function regionLuma(bitmap: Bitmap, region: LayoutRegion): number {
  const rect = toPixelRect(region.rect, bitmap.width, bitmap.height);
  const { r, g, b } = meanColor(bitmap, rect);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Keep the seed (or a saved profile) when it already sits on the portraits.
 * Only jump to a measured column when that column is clearly brighter — the
 * 16:9 seed in a letterboxed phone share is a black bar, and the real faces
 * are further in.
 */
export function brighterColumns(
  bitmap: Bitmap,
  profile: LayoutProfile,
  measured: readonly LayoutRegion[],
): LayoutRegion[] {
  const adopted: LayoutRegion[] = [];
  for (const role of ['ally', 'enemy'] as const) {
    const seed = profile.regions.filter((region) => region.role === role);
    const found = measured.filter((region) => region.role === role);
    if (found.length < TEAM_SLOTS || seed.length === 0) continue;
    const seedMean = seed.reduce((sum, region) => sum + regionLuma(bitmap, region), 0) / seed.length;
    const foundMean =
      found.reduce((sum, region) => sum + regionLuma(bitmap, region), 0) / found.length;
    if (foundMean > seedMean + 10) adopted.push(...found);
  }
  return adopted;
}

export function withMeasuredRegions(
  profile: LayoutProfile,
  measured: readonly LayoutRegion[],
): LayoutProfile {
  const replaced = new Map(measured.map((region) => [region.key, region]));
  const measuredRoles = new Set(measured.map((region) => region.role));
  const next = {
    ...profile,
    regions: profile.regions
      .filter((region) => !measuredRoles.has(region.role) || replaced.has(region.key))
      .map((region) => replaced.get(region.key) ?? region),
  };
  return measuredRoles.has('ally') ? shiftCompanionRegions(next, measured) : next;
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
  const measured = [
    ...(locateBanTrays(bitmap) ?? []),
    ...brighterColumns(bitmap, seed, locatePortraitColumns(bitmap) ?? []),
  ];
  const started = measured.length ? withMeasuredRegions(seed, measured) : seed;

  const regions = started.regions.map((region) => {
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
      ...started,
      regions,
      source: hits.size > 0 || measured.length > 0 ? 'calibrated' : seed.source,
    },
    hits,
  };
}
