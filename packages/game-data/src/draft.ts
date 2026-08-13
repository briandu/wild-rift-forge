import type { TierLane, TierLetter } from './index';

export type DraftPlacement = {
  slug: string;
  name: string;
  lane: TierLane;
  letter: TierLetter;
  score: number;
  winRate: number;
  roles: string[];
};

export type DraftSuggestion = {
  slug: string;
  name: string;
  score: number;
  tag: 'BEST FIT' | 'STRONG' | 'PLAYABLE';
  why: string;
  reasons: string[];
};

/** What a five-champion composition needs to function. */
export type CompTrait = 'frontline' | 'engage' | 'magic' | 'physical' | 'crowdControl';

export type CompStatus = 'Covered' | 'Thin' | 'Missing';

export type CompNeed = {
  trait: CompTrait;
  label: string;
  status: CompStatus;
  /** Coverage as a CSS width, e.g. "64%". */
  width: string;
  /** Status colour token. */
  color: string;
};

/**
 * How much each role contributes to each trait. Roles are the only champion
 * classification currently in the dataset, so these weights are an approximation
 * until per-champion traits are ingested.
 */
const TRAIT_WEIGHTS: Record<string, Partial<Record<CompTrait, number>>> = {
  tank: { frontline: 1, engage: 0.9, crowdControl: 1 },
  fighter: { frontline: 0.8, engage: 0.5, physical: 0.8 },
  assassin: { physical: 1, engage: 0.3 },
  mage: { magic: 1, crowdControl: 0.5 },
  marksman: { physical: 1 },
  support: { crowdControl: 0.8, engage: 0.3, magic: 0.4 },
};

/** Coverage a complete comp should reach for each trait. */
const TRAIT_TARGET: Record<CompTrait, number> = {
  frontline: 1.8,
  engage: 1.4,
  magic: 1.4,
  physical: 2,
  crowdControl: 2.2,
};

const TRAIT_LABEL: Record<CompTrait, string> = {
  frontline: 'Frontline',
  engage: 'Engage',
  magic: 'Magic damage',
  physical: 'Physical damage',
  crowdControl: 'Crowd control',
};

/** Traits surfaced on the draft board, in display order. */
const SHOWN_TRAITS: readonly CompTrait[] = ['frontline', 'engage', 'magic', 'crowdControl'];

const ALL_TRAITS = Object.keys(TRAIT_TARGET) as CompTrait[];

function emptyCoverage(): Record<CompTrait, number> {
  return { frontline: 0, engage: 0, magic: 0, physical: 0, crowdControl: 0 };
}

/** Sum trait weights contributed by one champion's roles. */
export function traitsForRoles(roles: string[]): Record<CompTrait, number> {
  const totals = emptyCoverage();
  for (const role of roles) {
    const weights = TRAIT_WEIGHTS[role.toLowerCase()];
    if (!weights) continue;
    for (const trait of ALL_TRAITS) {
      totals[trait] += weights[trait] ?? 0;
    }
  }
  return totals;
}

/** Trait coverage across every locked ally. */
export function traitCoverage(allyRoles: string[][]): Record<CompTrait, number> {
  const totals = emptyCoverage();
  for (const roles of allyRoles) {
    const contribution = traitsForRoles(roles);
    for (const trait of ALL_TRAITS) {
      totals[trait] += contribution[trait];
    }
  }
  return totals;
}

function statusFor(ratio: number): { status: CompStatus; color: string } {
  if (ratio >= 0.7) return { status: 'Covered', color: 'var(--success)' };
  if (ratio >= 0.35) return { status: 'Thin', color: 'var(--warn)' };
  return { status: 'Missing', color: 'var(--danger)' };
}

export function compNeeds(allyRoles: string[][]): CompNeed[] {
  const coverage = traitCoverage(allyRoles);
  return SHOWN_TRAITS.map((trait) => {
    const ratio = coverage[trait] / TRAIT_TARGET[trait];
    const { status, color } = statusFor(ratio);
    return {
      trait,
      label: TRAIT_LABEL[trait],
      status,
      width: `${Math.max(8, Math.min(100, Math.round(ratio * 100)))}%`,
      color,
    };
  });
}

/** Traits the locked allies have not covered, worst gap first. */
export function compGaps(allyRoles: string[][]): CompTrait[] {
  const coverage = traitCoverage(allyRoles);
  return ALL_TRAITS.filter((trait) => coverage[trait] / TRAIT_TARGET[trait] < 0.7).sort(
    (a, b) => coverage[a] / TRAIT_TARGET[a] - coverage[b] / TRAIT_TARGET[b],
  );
}

export type DraftContext = {
  /** Lane opponent, when their pick is known. */
  enemy?: DraftPlacement | null;
  /** Champion slugs the user plays. */
  pool?: ReadonlySet<string>;
  /** Everything unavailable: picked by either team, plus bans. */
  taken?: ReadonlySet<string>;
  /** Banned slugs only. A subset of `taken`. */
  bans?: ReadonlySet<string>;
  /** Roles of already-locked allies, used to weight comp gaps. */
  allyRoles?: string[][];
};

/**
 * How many stronger same-lane champions the bans took out of contention.
 * A candidate that only ranks mid-tier becomes a genuinely better pick when the
 * champions above it are banned away.
 */
export function banLift(
  candidate: DraftPlacement,
  lanePool: DraftPlacement[],
  bans: ReadonlySet<string>,
): number {
  if (bans.size === 0) return 0;
  return lanePool.filter(
    (row) => row.slug !== candidate.slug && row.score > candidate.score && bans.has(row.slug),
  ).length;
}

export function draftFitScore(
  candidate: DraftPlacement,
  context: DraftContext = {},
  lanePool: DraftPlacement[] = [],
): { score: number; reasons: string[] } {
  const { enemy = null, pool, bans, allyRoles } = context;
  let score = candidate.score;
  const reasons: string[] = [];

  if (candidate.letter === 'S' || candidate.letter === 'A') {
    reasons.push(`${candidate.letter} tier ${candidate.lane}`);
  }

  if (enemy) {
    const delta = candidate.winRate - enemy.winRate;
    score += delta * 4;
    if (delta >= 1) {
      reasons.push(`Higher WR than ${enemy.name}`);
    }
  }

  if (pool?.has(candidate.slug)) {
    score += 8;
    reasons.push('In your pool');
  }

  if (allyRoles?.length) {
    const gaps = compGaps(allyRoles);
    const contribution = traitsForRoles(candidate.roles);
    const filled = gaps.filter((trait) => contribution[trait] >= 0.5);
    if (filled.length > 0) {
      score += Math.min(10, filled.length * 5);
      reasons.push(`Fills your ${TRAIT_LABEL[filled[0]!].toLowerCase()} gap`);
    }
  }

  if (bans && lanePool.length > 0) {
    const lift = banLift(candidate, lanePool, bans);
    if (lift > 0) {
      score += Math.min(6, lift * 2);
      reasons.push('Bans opened this lane');
    }
  }

  return { score: Math.max(40, Math.min(99, Math.round(score))), reasons: reasons.slice(0, 3) };
}

function whyFor(candidate: DraftPlacement, context: DraftContext, reasons: string[]): string {
  const base = context.enemy
    ? `${candidate.name} is a ${candidate.letter}-tier ${candidate.lane} pick into ${context.enemy.name}.`
    : `${candidate.name} is a ${candidate.letter}-tier ${candidate.lane} pick this patch.`;
  if (reasons.includes('Bans opened this lane')) {
    return `${base} The bans cleared the stronger picks above it.`;
  }
  const gapReason = reasons.find((reason) => reason.startsWith('Fills your'));
  return gapReason ? `${base} It also covers what your comp is missing.` : base;
}

export function rankDraftSuggestions(
  candidates: DraftPlacement[],
  context: DraftContext = {},
  limit = 3,
): DraftSuggestion[] {
  const taken = context.taken ?? new Set<string>();
  return candidates
    .filter((row) => !taken.has(row.slug))
    .map((row) => {
      const fit = draftFitScore(row, context, candidates);
      const tag: DraftSuggestion['tag'] =
        fit.score >= 88 ? 'BEST FIT' : fit.score >= 70 ? 'STRONG' : 'PLAYABLE';
      return {
        slug: row.slug,
        name: row.name,
        score: fit.score,
        tag,
        why: whyFor(row, context, fit.reasons),
        reasons: fit.reasons,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
