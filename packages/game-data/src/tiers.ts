type ChangeType = 'buff' | 'nerf' | 'adjustment' | 'new' | 'rework' | 'unknown';

export type RankBracket = 'all' | 'diamond_plus' | 'master_plus' | 'challenger_plus' | 'legendary';

export type TierLane = 'Top' | 'Jungle' | 'Mid' | 'Dragon' | 'Support';

export type TierLetter = 'S+' | 'S' | 'A' | 'B' | 'C';

export type TierRuleset = 'cn_stats_v1' | 'blended_v1';

export const TIER_LANES: readonly TierLane[] = ['Top', 'Jungle', 'Mid', 'Dragon', 'Support'];

export const TIER_LETTERS: readonly TierLetter[] = ['S+', 'S', 'A', 'B', 'C'];

export const DEFAULT_RANK_BRACKET: RankBracket = 'diamond_plus';

export const TIER_RULESET_CN = 'cn_stats_v1' satisfies TierRuleset;

export const TIER_RULESET_BLENDED = 'blended_v1' satisfies TierRuleset;

/** Live API and alerts read this ruleset. */
export const DEFAULT_TIER_RULESET: TierRuleset = TIER_RULESET_BLENDED;

/**
 * Tunables for blended_v1. Kept in one block so they can be adjusted from the
 * preview diff without hunting through callers.
 */
/** Pick-rate points that count as one "pseudo-game" for shrinkage. */
export const SHRINKAGE_K = 1.75;
/** How much of WR(challenger+) − WR(all) is subtracted from the audience score. */
export const SKILL_SPREAD_WEIGHT = 0.5;
/** Hard cap on the skill-spread adjustment, in win-rate points. */
export const SKILL_SPREAD_CAP = 1.5;
/** Ban rate still signals perceived oppressiveness; keep this small. */
export const BAN_RATE_WEIGHT = 0.1;
/** Hard cap on the ban-rate bonus, in win-rate points. */
export const BAN_RATE_CAP = 1.5;
/** Maximum signed patch-note nudge, in win-rate points. */
export const PATCH_NUDGE_CAP = 1;
/** Days until a patch nudge decays to zero. */
export const PATCH_NUDGE_DECAY_DAYS = 7;
/** Extra score a champion must clear past a band floor before the letter flips. */
export const HYSTERESIS_MARGIN = 0.4;
/** Absolute score floors. Rank percentile alone cannot manufacture an S or S+ tier. */
export const TIER_SCORE_FLOORS: Record<TierLetter, number> = {
  'S+': 53.5,
  S: 52.5,
  A: 50.5,
  B: 48.5,
  C: Number.NEGATIVE_INFINITY,
};

export interface TierBandCounts {
  'S+': number;
  S: number;
  A: number;
  B: number;
  C: number;
}

export interface CompositeTierScoreInput {
  winRate: number;
  pickRate: number;
  banRate: number;
  laneMeanWinRate: number;
  challengerWinRate: number | null;
  allWinRate: number | null;
  patchNudge: number;
}

export interface CompositeTierScore {
  score: number;
  adjustedWinRate: number;
  skillSpread: number;
  confidence: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function letterIndex(letter: TierLetter): number {
  return TIER_LETTERS.indexOf(letter);
}

/** Legacy cn_stats_v1 score. Win rate is primary; pick/ban add contested-pick pressure. */
export function championTierScore(winRate: number, pickRate: number, banRate: number): number {
  return winRate + 0.15 * pickRate + 0.1 * banRate;
}

/** Relative S+/S/A/B/C sizes for a lane: ~5% / 10% / 20% / 40% / remainder. */
export function tierBandCounts(n: number): TierBandCounts {
  if (n <= 0) {
    return { 'S+': 0, S: 0, A: 0, B: 0, C: 0 };
  }
  const sPlus = Math.round(n * 0.05);
  const s = Math.max(1, Math.round(n * 0.1));
  const a = Math.round(n * 0.2);
  const b = Math.round(n * 0.4);
  let counts: TierBandCounts = { 'S+': sPlus, S: s, A: a, B: b, C: n - sPlus - s - a - b };
  for (const letter of ['B', 'A', 'S', 'S+'] as const) {
    while (counts.C < 0 && counts[letter] > 0) {
      counts = { ...counts, [letter]: counts[letter] - 1, C: counts.C + 1 };
    }
  }
  if (counts.C < 0) {
    counts = { ...counts, C: 0 };
  }
  return counts;
}

export function assignTierLetter(rankInLane: number, counts: TierBandCounts): TierLetter {
  if (rankInLane <= counts['S+']) {
    return 'S+';
  }
  if (rankInLane <= counts['S+'] + counts.S) {
    return 'S';
  }
  if (rankInLane <= counts['S+'] + counts.S + counts.A) {
    return 'A';
  }
  if (rankInLane <= counts['S+'] + counts.S + counts.A + counts.B) {
    return 'B';
  }
  return 'C';
}

/**
 * S+ is the headline band. Floors, hysteresis, and review moves can empty it;
 * pull the top S champs up so a lane never shows S+ with nobody in it.
 * Weak lanes that never reached S stay without S+.
 */
export function fillEmptySPlus<T extends { letter: TierLetter; rankInLane: number }>(
  rows: readonly T[],
  intendedCount = 1,
): T[] {
  if (rows.length === 0 || rows.some((row) => row.letter === 'S+')) {
    return [...rows];
  }
  const fromS = rows
    .filter((row) => row.letter === 'S')
    .sort((a, b) => a.rankInLane - b.rankInLane);
  if (fromS.length === 0) {
    return [...rows];
  }
  const promote = new Set(fromS.slice(0, Math.max(1, intendedCount)));
  return rows.map((row) => (promote.has(row) ? { ...row, letter: 'S+' } : row));
}

/** Empirical Bayes shrink of a noisy win rate toward the lane mean. */
export function shrinkWinRate(winRate: number, pickRate: number, laneMeanWinRate: number): number {
  const weight = pickRate / (pickRate + SHRINKAGE_K);
  return laneMeanWinRate + (winRate - laneMeanWinRate) * weight;
}

export function skillSpread(challengerWinRate: number | null, allWinRate: number | null): number {
  if (challengerWinRate == null || allWinRate == null) {
    return 0;
  }
  return challengerWinRate - allWinRate;
}

/**
 * Positive spread (better in Challenger) is subtracted so high-skill champions
 * are not overrated for a typical ladder player.
 */
export function skillSpreadAdjustment(spread: number): number {
  return clamp(-spread * SKILL_SPREAD_WEIGHT, -SKILL_SPREAD_CAP, SKILL_SPREAD_CAP);
}

export function patchChangeSign(changeTypes: readonly ChangeType[]): -1 | 0 | 1 {
  let net = 0;
  for (const changeType of changeTypes) {
    if (changeType === 'buff' || changeType === 'new') {
      net += 1;
    } else if (changeType === 'nerf') {
      net -= 1;
    }
  }
  if (net > 0) {
    return 1;
  }
  if (net < 0) {
    return -1;
  }
  return 0;
}

export function daysSincePatch(releaseDate: string | null | undefined, snapshotDate: string): number {
  if (!releaseDate) {
    return 0;
  }
  const from = Date.parse(`${releaseDate.slice(0, 10)}T00:00:00.000Z`);
  const to = Date.parse(`${snapshotDate}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return 0;
  }
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

export function patchNudge(sign: number, days: number): number {
  const decay = Math.max(0, 1 - days / PATCH_NUDGE_DECAY_DAYS);
  return clamp(sign, -1, 1) * PATCH_NUDGE_CAP * decay;
}

export function compositeTierScore(input: CompositeTierScoreInput): CompositeTierScore {
  const confidence = input.pickRate / (input.pickRate + SHRINKAGE_K);
  const adjustedWinRate = shrinkWinRate(input.winRate, input.pickRate, input.laneMeanWinRate);
  const spread = skillSpread(input.challengerWinRate, input.allWinRate);
  const banAdj = clamp(BAN_RATE_WEIGHT * input.banRate, 0, BAN_RATE_CAP);
  const score = adjustedWinRate + skillSpreadAdjustment(spread) + banAdj + input.patchNudge;
  return { score, adjustedWinRate, skillSpread: spread, confidence };
}

/** Rank percentile and an absolute floor must both clear. */
export function assignTierLetterHybrid(
  rankInLane: number,
  counts: TierBandCounts,
  score: number,
): TierLetter {
  let letter = assignTierLetter(rankInLane, counts);
  let index = letterIndex(letter);
  while (index < TIER_LETTERS.length - 1 && score < TIER_SCORE_FLOORS[TIER_LETTERS[index]!]) {
    index += 1;
    letter = TIER_LETTERS[index]!;
  }
  return letter;
}

/**
 * Hold the previous letter unless the new score crosses the band floor by a
 * margin. Jumps of two or more letters skip the hold — those are not flaps.
 */
export function assignTierLetterWithHysteresis(
  proposed: TierLetter,
  previous: TierLetter | null | undefined,
  score: number,
): TierLetter {
  if (!previous || previous === proposed) {
    return proposed;
  }
  const proposedIdx = letterIndex(proposed);
  const previousIdx = letterIndex(previous);
  if (Math.abs(proposedIdx - previousIdx) >= 2) {
    return proposed;
  }
  if (proposedIdx < previousIdx) {
    return score >= TIER_SCORE_FLOORS[proposed] + HYSTERESIS_MARGIN ? proposed : previous;
  }
  return score <= TIER_SCORE_FLOORS[previous] - HYSTERESIS_MARGIN ? proposed : previous;
}

/** +1 promotes toward S+, −1 demotes toward C. Clamped to one letter. */
export function applyLetterAdjustment(letter: TierLetter, delta: number): TierLetter {
  const step = clamp(Math.trunc(delta), -1, 1);
  const next = clamp(letterIndex(letter) - step, 0, TIER_LETTERS.length - 1);
  return TIER_LETTERS[next]!;
}

export function adjustmentKey(championId: number, lane: TierLane): string {
  return `${championId}:${lane}`;
}
