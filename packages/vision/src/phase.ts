/**
 * Champion-select phase from the HUD title, not from which portraits are filled.
 *
 * Wild Rift writes the current step in the same place every time: a white
 * uppercase line at the top centre (`BANNING PHASE`, `SELECT YOUR CHAMPION!`,
 * `PREPARATION PHASE`, …). Match-found uses the same idea in the centre modal.
 * Hashing that isolated line is enough to tell the steps apart, and it stays
 * under the pick timer — no OCR model.
 *
 * Title hashes are measured from real frames (iPhone 19.5:9 stills and the 16:9
 * reference). A new device can add another template of the same phrase.
 */

import { cropBitmap, toGray, toPixelRect, type Bitmap, type NormalizedRect } from './bitmap';
import { dhash, hamming, type Hash64 } from './hash';

/**
 * Which step of a ranked queue the frame looks like.
 *
 * `pick` and `ban` stay as the coarse fallbacks used when the title cannot be
 * read. The more specific values come from the on-screen phrase.
 */
export type DraftPhase =
  | 'match-found'
  | 'lane'
  | 'pre-pick'
  | 'ban'
  | 'ban-reveal'
  | 'pick-ally'
  | 'pick-self'
  | 'pick-enemy'
  | 'pick'
  | 'prep'
  | 'loading'
  | 'unknown';

export type HudTitle = {
  hash: Hash64;
  aspect: number;
  /** Isolated title width as a fraction of the search strip. */
  span: number;
  width: number;
  height: number;
  source: 'header' | 'modal';
};

export type PhaseTemplate = {
  phase: DraftPhase;
  /** The on-screen phrase this template was measured from. */
  label: string;
  hash: Hash64;
  /** Width / height of the isolated title, used to reject lookalikes. */
  aspect: number;
  source?: HudTitle['source'];
};

export type DetectPhaseOptions = {
  templates?: readonly PhaseTemplate[];
};

/** Top-centre strip that holds the phase title. Ban trays sit outside it. */
export const PHASE_HEADER: NormalizedRect = { x: 0.3, y: 0, width: 0.4, height: 0.085 };

/** Centre of the match-found ring, above the ACCEPT button. */
export const MATCH_MODAL: NormalizedRect = { x: 0.3, y: 0.3, width: 0.4, height: 0.16 };

/** White HUD text on the dark champion-select chrome. */
const TEXT_LUMA = 165;

/** Loading nameplates fill the header; phase titles stay a centred phrase. */
const LOADING_SPAN = 0.82;

/** "BANS" is a short centred word; nothing else in this strip is that squat. */
const BAN_REVEAL_ASPECT = 2.8;

const MAX_HAMMING = 12;
const MAX_ASPECT_DELTA = 1.35;

/**
 * Measured from the iPhone stills in this draft and the 16:9 banning reference.
 * Each row is one rendering of a phrase; the same phase may have several.
 */
export const PHASE_TEMPLATES: readonly PhaseTemplate[] = [
  { phase: 'match-found', label: 'Match found', hash: 'cfcf8f8685858585', aspect: 7.471, source: 'modal' },
  { phase: 'match-found', label: 'Waiting for other players', hash: '4dcdcdcdcd858382', aspect: 6, source: 'modal' },
  { phase: 'lane', label: 'YOUR LANE', hash: 'ac28280a1b1f0f0f', aspect: 9.786, source: 'header' },
  { phase: 'pre-pick', label: 'PRE-PICK A CHAMPION!', hash: '0f0f0f0d96d696af', aspect: 8.944, source: 'header' },
  { phase: 'ban', label: 'BANNING PHASE', hash: '8e583aaaa988cafa', aspect: 8.143, source: 'header' },
  { phase: 'ban', label: 'BANNING PHASE', hash: '1eaf8e0f0f0f0f0f', aspect: 3.828, source: 'header' },
  { phase: 'ban-reveal', label: 'BANS', hash: 'd4d5d292c8e8a659', aspect: 2.643, source: 'header' },
  { phase: 'pick-ally', label: 'YOUR TEAM IS PICKING', hash: 'a2ce4e4c5454170f', aspect: 12.308, source: 'header' },
  { phase: 'pick-self', label: 'SELECT YOUR CHAMPION!', hash: '95998acbcbd6d5ad', aspect: 12.786, source: 'header' },
  { phase: 'pick-enemy', label: 'OPPONENTS PICKING', hash: 'cb6b3914b09a8000', aspect: 10.286, source: 'header' },
  { phase: 'prep', label: 'PREPARATION PHASE', hash: 'eee6e7a5b474b6b2', aspect: 10.571, source: 'header' },
];

const PHASE_LABELS: Record<DraftPhase, string> = {
  'match-found': 'Match found',
  lane: 'Your lane',
  'pre-pick': 'Pre-pick a champion',
  ban: 'Banning phase',
  'ban-reveal': 'Bans',
  'pick-ally': 'Your team is picking',
  'pick-self': 'Select your champion',
  'pick-enemy': 'Opponents picking',
  pick: 'Picking',
  prep: 'Preparation phase',
  loading: 'Loading',
  unknown: 'Unknown',
};

/** Player-row portraits are account avatars (or empty) during these steps. */
const AVATAR_PHASES: ReadonlySet<DraftPhase> = new Set([
  'match-found',
  'lane',
  'pre-pick',
  'ban',
  'ban-reveal',
]);

export function phaseLabel(phase: DraftPhase): string {
  return PHASE_LABELS[phase];
}

export function isAvatarPhase(phase: DraftPhase): boolean {
  return AVATAR_PHASES.has(phase);
}

type Band = { y: number; height: number };

function rowBands(fill: Float32Array, minFill: number, minHeight: number): Band[] {
  const raw: Band[] = [];
  let start = -1;
  for (let y = 0; y < fill.length; y += 1) {
    const on = (fill[y] ?? 0) >= minFill;
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      raw.push({ y: start, height: y - start });
      start = -1;
    }
  }
  if (start >= 0) raw.push({ y: start, height: fill.length - start });

  // Glyph waists drop below the fill threshold for a row or two; the timer sits
  // further down, so a small merge gap joins a letter without swallowing digits.
  const maxGap = Math.max(2, Math.round(fill.length * 0.08));
  const merged: Band[] = [];
  for (const band of raw) {
    const prev = merged[merged.length - 1];
    if (prev && band.y - (prev.y + prev.height) <= maxGap) {
      prev.height = band.y + band.height - prev.y;
    } else {
      merged.push({ ...band });
    }
  }
  return merged.filter((band) => band.height >= minHeight);
}

/**
 * Keep the title line and drop the countdown sitting under it.
 *
 * Only split a band tall enough to hold both; a valley inside a single line of
 * letters is just the waist of the glyphs.
 */
function titleBand(fill: Float32Array, band: Band): Band {
  if (band.height < Math.max(20, Math.round(fill.length * 0.55))) return band;
  const start = band.y;
  const end = band.y + band.height;
  let peak = 0;
  for (let y = start; y < end; y += 1) {
    peak = Math.max(peak, fill[y] ?? 0);
  }
  let valleyY = -1;
  let valley = peak;
  const from = start + Math.floor(band.height * 0.45);
  for (let y = from; y < end - 1; y += 1) {
    const value = fill[y] ?? 0;
    if (value < valley) {
      valley = value;
      valleyY = y;
    }
  }
  if (valleyY >= 0 && valley < peak * 0.35) {
    return { y: start, height: Math.max(minTitleHeight(fill.length), valleyY - start) };
  }
  return band;
}

function minTitleHeight(cropHeight: number): number {
  return Math.max(5, Math.round(cropHeight * 0.12));
}

function isolateTitle(
  bitmap: Bitmap,
  region: NormalizedRect,
): { tile: Bitmap; aspect: number; span: number } | null {
  const rect = toPixelRect(region, bitmap.width, bitmap.height);
  if (rect.width < 16 || rect.height < 8) return null;
  const crop = cropBitmap(bitmap, rect);
  const gray = toGray(crop);
  const fill = new Float32Array(gray.height);
  let top = gray.height;
  let bottom = -1;
  for (let y = 0; y < gray.height; y += 1) {
    let bright = 0;
    for (let x = 0; x < gray.width; x += 1) {
      if ((gray.data[y * gray.width + x] ?? 0) >= TEXT_LUMA) bright += 1;
    }
    fill[y] = bright;
    if (bright > 0) {
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (bottom < top) return null;

  const tight: Band = { y: top, height: bottom - top + 1 };
  const minFill = Math.max(2, Math.round(gray.width * 0.012));
  const bands = rowBands(fill, minFill, minTitleHeight(gray.height));
  const first = bands[0] && bands[0].height >= tight.height * 0.6 ? bands[0] : tight;
  const band = titleBand(fill, first);

  let left = gray.width;
  let right = -1;
  for (let y = band.y; y < band.y + band.height; y += 1) {
    for (let x = 0; x < gray.width; x += 1) {
      if ((gray.data[y * gray.width + x] ?? 0) < TEXT_LUMA) continue;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < left) return null;

  const tile = cropBitmap(crop, {
    x: left,
    y: band.y,
    width: right - left + 1,
    height: band.height,
  });
  if (tile.width < 10 || tile.height < 6) return null;
  return { tile, aspect: tile.width / tile.height, span: tile.width / crop.width };
}

function titleFrom(bitmap: Bitmap, region: NormalizedRect, source: HudTitle['source']): HudTitle | null {
  const isolated = isolateTitle(bitmap, region);
  if (!isolated) return null;
  return {
    hash: dhash(isolated.tile, 1),
    aspect: isolated.aspect,
    span: isolated.span,
    width: isolated.tile.width,
    height: isolated.tile.height,
    source,
  };
}

/** Isolated HUD title, or null when the strip is empty. */
export function readHudTitle(bitmap: Bitmap): HudTitle | null {
  return titleFrom(bitmap, PHASE_HEADER, 'header') ?? titleFrom(bitmap, MATCH_MODAL, 'modal');
}

function matchTemplates(
  title: HudTitle,
  templates: readonly PhaseTemplate[],
): { phase: DraftPhase; distance: number } | null {
  let best: { phase: DraftPhase; distance: number } | null = null;
  for (const template of templates) {
    if (template.source && template.source !== title.source) continue;
    if (Math.abs(title.aspect - template.aspect) > MAX_ASPECT_DELTA) continue;
    const distance = hamming(title.hash, template.hash);
    if (distance > MAX_HAMMING) continue;
    if (!best || distance < best.distance) best = { phase: template.phase, distance };
  }
  return best;
}

/**
 * Read the on-screen phase title.
 *
 * Falls back to aspect-only hints (`BANS` is short, the loading strip is very
 * wide) when no stored template is close enough.
 */
export function detectPhase(bitmap: Bitmap, options: DetectPhaseOptions = {}): DraftPhase {
  const templates = options.templates ?? PHASE_TEMPLATES;
  const header = titleFrom(bitmap, PHASE_HEADER, 'header');
  if (header) {
    const matched = matchTemplates(header, templates);
    if (matched) return matched.phase;
    if (header.span >= LOADING_SPAN) return 'loading';
    if (header.aspect <= BAN_REVEAL_ASPECT) return 'ban-reveal';
  }

  const modal = titleFrom(bitmap, MATCH_MODAL, 'modal');
  if (modal) {
    const matched = matchTemplates(modal, templates);
    if (matched) return matched.phase;
    if (!header && modal.span < LOADING_SPAN) return 'match-found';
  }

  return 'unknown';
}
