/**
 * Read the lane name printed beside each ally row.
 *
 * Ranked draft lists players in pick order, not Baron→Support. Until a pick
 * locks, the HUD still says `BARON LANE` / `JUNGLE` / … — that is how we map a
 * visual row onto the board. A locked row swaps that label for the champion
 * name, so a missing label plus a bright portrait means the pick is real.
 * A dimmed portrait with the lane name still showing is only a pre-pick.
 */

import { cropBitmap, meanColor, toGray, toPixelRect, type Bitmap, type NormalizedRect } from './bitmap';
import { dhash, hamming, type Hash64 } from './hash';

export type DraftLane = 'Top' | 'Jungle' | 'Mid' | 'Dragon' | 'Support';

export const DRAFT_LANES: readonly DraftLane[] = ['Top', 'Jungle', 'Mid', 'Dragon', 'Support'];

export type LaneTemplate = {
  lane: DraftLane;
  label: string;
  hash: Hash64;
  aspect: number;
};

const TEXT_LUMA = 110;
const MAX_HAMMING = 12;
const MAX_ASPECT_DELTA = 1.6;
/** Locked portraits are full-colour; pre-picks stay dim even after the name appears. */
const LOCKED_MIN_LUMA = 50;

/**
 * Measured from iPhone ranked stills. `BARON LANE` is Top on the board.
 * Tests inject their own painted-letter templates.
 */
export const LANE_TEMPLATES: readonly LaneTemplate[] = [
  { lane: 'Support', label: 'SUPPORT', hash: '6e65d973f546c9a9', aspect: 3.32 },
  { lane: 'Support', label: 'SUPPORT', hash: 'd69698c8cac9e0e3', aspect: 5.32 },
  { lane: 'Dragon', label: 'DRAGON LANE', hash: '25785a86ccdd2f7f', aspect: 3.95 },
  { lane: 'Dragon', label: 'DRAGON LANE', hash: 'c6e6ae8fbfbfe6c6', aspect: 6.5 },
  { lane: 'Dragon', label: 'DRAGON LANE', hash: 'b2f0feeeeee2e1e5', aspect: 4.67 },
  { lane: 'Dragon', label: 'DRAGON LANE', hash: '0203327a73f3f3fb', aspect: 9.21 },
  { lane: 'Top', label: 'BARON LANE', hash: '89ada06565252521', aspect: 5.73 },
  { lane: 'Top', label: 'BARON LANE', hash: 'f4ffff9fdbdb4b63', aspect: 3.71 },
  { lane: 'Top', label: 'BARON LANE', hash: 'd894649493d3cb63', aspect: 3.36 },
  { lane: 'Top', label: 'BARON LANE', hash: '9ebfbfbf1b13137b', aspect: 5.09 },
  { lane: 'Jungle', label: 'JUNGLE', hash: 'bfbfdffeffbfcfdf', aspect: 6.41 },
  { lane: 'Jungle', label: 'JUNGLE', hash: 'c4e2a6e656757572', aspect: 3.8 },
  { lane: 'Jungle', label: 'JUNGLE', hash: 'bebeaa933737777f', aspect: 6.5 },
  { lane: 'Mid', label: 'MID LANE', hash: 'fe6e6e5effffffbb', aspect: 6.41 },
  { lane: 'Mid', label: 'MID LANE', hash: 'aeb79737777fff9f', aspect: 6.5 },
  { lane: 'Support', label: 'SUPPORT', hash: '0faf97b6bebeaeaf', aspect: 6.5 },
];

export function laneIndex(lane: DraftLane): number {
  return DRAFT_LANES.indexOf(lane);
}

export function readLaneSignature(
  bitmap: Bitmap,
  region: NormalizedRect,
): { hash: Hash64; aspect: number } | null {
  return isolateText(bitmap, region);
}

function isolateText(bitmap: Bitmap, region: NormalizedRect): { hash: Hash64; aspect: number } | null {
  const rect = toPixelRect(region, bitmap.width, bitmap.height);
  if (rect.width < 12 || rect.height < 6) return null;
  const crop = cropBitmap(bitmap, rect);
  const gray = toGray(crop);
  let top = gray.height;
  let bottom = -1;
  let left = gray.width;
  let right = -1;
  for (let y = 0; y < gray.height; y += 1) {
    for (let x = 0; x < gray.width; x += 1) {
      if ((gray.data[y * gray.width + x] ?? 0) < TEXT_LUMA) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < top || right < left) return null;
  const tile = cropBitmap(crop, {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
  });
  if (tile.width < 8 || tile.height < 5) return null;
  return { hash: dhash(tile, 1), aspect: tile.width / tile.height };
}

export function readLaneLabel(
  bitmap: Bitmap,
  region: NormalizedRect,
  templates: readonly LaneTemplate[] = LANE_TEMPLATES,
): DraftLane | null {
  const title = isolateText(bitmap, region);
  if (!title) return null;
  let best: { lane: DraftLane; distance: number } | null = null;
  for (const template of templates) {
    if (Math.abs(title.aspect - template.aspect) > MAX_ASPECT_DELTA) continue;
    const distance = hamming(title.hash, template.hash);
    if (distance > MAX_HAMMING) continue;
    if (!best || distance < best.distance) best = { lane: template.lane, distance };
  }
  return best?.lane ?? null;
}

/** Fill the one leftover lane when four rows already named themselves. */
export function inferMissingLanes(rows: Array<DraftLane | null>): Array<DraftLane | null> {
  const next = [...rows];
  const used = new Set(next.filter((lane): lane is DraftLane => Boolean(lane)));
  const missing = DRAFT_LANES.filter((lane) => !used.has(lane));
  const holes = next.flatMap((lane, index) => (lane ? [] : [index]));
  if (missing.length === 1 && holes.length === 1) {
    next[holes[0]!] = missing[0]!;
  }
  return next;
}

export function mergeRowLanes(
  previous: Array<DraftLane | null> | undefined,
  incoming: Array<DraftLane | null>,
): Array<DraftLane | null> {
  const length = Math.max(DRAFT_LANES.length, incoming.length, previous?.length ?? 0);
  const merged: Array<DraftLane | null> = Array.from({ length }, (_, index) => {
    return incoming[index] ?? previous?.[index] ?? null;
  });
  return inferMissingLanes(merged).slice(0, DRAFT_LANES.length);
}

export function isLockedPortrait(bitmap: Bitmap): boolean {
  const inset = Math.round(Math.min(bitmap.width, bitmap.height) * 0.2);
  const { r, g, b } = meanColor(bitmap, {
    x: inset,
    y: inset,
    width: Math.max(1, bitmap.width - inset * 2),
    height: Math.max(1, bitmap.height - inset * 2),
  });
  return 0.299 * r + 0.587 * g + 0.114 * b >= LOCKED_MIN_LUMA;
}

/**
 * A row is a real pick only when the lane label is gone (replaced by the
 * champion name) and the portrait is bright. Pre-picks keep the lane name and
 * a darkened portrait.
 */
export function isLockedPick(portrait: Bitmap, laneLabel: DraftLane | null): boolean {
  if (laneLabel) return false;
  return isLockedPortrait(portrait);
}
