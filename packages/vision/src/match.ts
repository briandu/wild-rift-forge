import {
  colorDistance,
  hamming,
  isHash64,
  type ColorSignature,
  type Hash64,
} from './hash';

/**
 * Where a reference signature came from.
 *
 * `thumb` and `portrait` are derived from hosted art, which is close to but not
 * identical to what the game renders. `captured` signatures come from frames a
 * user confirmed, so they are the most trustworthy and win ties.
 */
export type IconVariant = 'thumb' | 'portrait' | 'captured';

export type IconReference = {
  slug: string;
  hash: Hash64;
  color?: ColorSignature;
  variant?: IconVariant;
};

export type TileMatch = {
  slug: string;
  /** Hamming distance in bits, 0-64. */
  distance: number;
  /** Colour signature distance, 0-1. */
  colorDistance: number;
  /** Combined 0-1 score. */
  confidence: number;
  variant: IconVariant;
};

export type TileMatchResult = {
  best: TileMatch | null;
  /** Best match belonging to a different champion, used to measure separation. */
  runnerUp: TileMatch | null;
  accepted: boolean;
};

/** Beyond this many differing bits the tile is treated as unrelated artwork. */
const MAX_DISTANCE = 24;

/** Distance gap over which a match counts as cleanly separated from the next champion. */
const SEPARATION_SPAN = 6;

/** A confirmed capture is worth this many bits of benefit of the doubt. */
const CAPTURED_BONUS = 1;

export const DEFAULT_ACCEPT_CONFIDENCE = 0.55;

/** Hard ceiling: no match is accepted past this distance regardless of separation. */
const ACCEPT_MAX_DISTANCE = 18;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export type MatchTileOptions = {
  /** Minimum confidence for {@link TileMatchResult.accepted}. */
  acceptConfidence?: number;
  /** Restrict matching to these slugs, e.g. to exclude already-identified champions. */
  allow?: ReadonlySet<string>;
};

/**
 * Identify a tile against the reference library.
 *
 * Confidence blends three signals: how close the closest champion is, how much
 * daylight there is to the next-closest champion, and whether the colours agree.
 * A tile showing an empty slot matches nothing well and is left unaccepted rather
 * than being forced onto the nearest champion.
 */
export function matchTile(
  hash: Hash64,
  color: ColorSignature | undefined,
  references: readonly IconReference[],
  options: MatchTileOptions = {},
): TileMatchResult {
  const { acceptConfidence = DEFAULT_ACCEPT_CONFIDENCE, allow } = options;
  if (!isHash64(hash)) {
    return { best: null, runnerUp: null, accepted: false };
  }

  // `distance` stays the true bit distance for reporting, while `rank` carries the
  // variant preference so a confirmed capture wins a tie without distorting the
  // number the UI shows.
  const bySlug = new Map<string, { match: TileMatch; rank: number }>();
  for (const reference of references) {
    if (allow && !allow.has(reference.slug)) continue;
    const distance = hamming(hash, reference.hash);
    if (!Number.isFinite(distance)) continue;
    const variant = reference.variant ?? 'thumb';
    const rank = distance - (variant === 'captured' ? CAPTURED_BONUS : 0);
    const tint = color && reference.color ? colorDistance(color, reference.color) : 0;
    const existing = bySlug.get(reference.slug);
    if (!existing || rank < existing.rank) {
      bySlug.set(reference.slug, {
        rank,
        match: { slug: reference.slug, distance, colorDistance: tint, confidence: 0, variant },
      });
    }
  }

  const ranked = [...bySlug.values()].sort((a, b) => a.rank - b.rank);
  const best = ranked[0]?.match;
  const runnerUp = ranked[1]?.match ?? null;
  if (!best) {
    return { best: null, runnerUp: null, accepted: false };
  }

  const similarity = clamp01((MAX_DISTANCE - best.distance) / MAX_DISTANCE);
  const separation = runnerUp
    ? clamp01((runnerUp.distance - best.distance) / SEPARATION_SPAN)
    : 1;
  const colorAgreement = 1 - 0.35 * best.colorDistance;
  const confidence = clamp01(similarity * (0.65 + 0.35 * separation) * colorAgreement);

  const scored: TileMatch = { ...best, confidence };
  return {
    best: scored,
    runnerUp: runnerUp ? { ...runnerUp, confidence: 0 } : null,
    accepted: confidence >= acceptConfidence && best.distance <= ACCEPT_MAX_DISTANCE,
  };
}
