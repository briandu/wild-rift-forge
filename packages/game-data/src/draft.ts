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

const FRONTLINE = new Set(['tank', 'fighter']);
const MAGIC = new Set(['mage', 'support']);

export function draftFitScore(
  candidate: DraftPlacement,
  enemy: DraftPlacement | null,
  inPool: boolean,
): { score: number; reasons: string[] } {
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
  if (inPool) {
    score += 8;
    reasons.push('In your pool');
  }
  return { score: Math.max(40, Math.min(99, Math.round(score))), reasons: reasons.slice(0, 3) };
}

export function rankDraftSuggestions(
  candidates: DraftPlacement[],
  enemy: DraftPlacement | null,
  pool: Set<string>,
  taken: Set<string>,
  limit = 3,
): DraftSuggestion[] {
  const ranked = candidates
    .filter((row) => !taken.has(row.slug))
    .map((row) => {
      const fit = draftFitScore(row, enemy, pool.has(row.slug));
      const tag: DraftSuggestion['tag'] =
        fit.score >= 88 ? 'BEST FIT' : fit.score >= 70 ? 'STRONG' : 'PLAYABLE';
      const why = enemy
        ? `${row.name} is a ${row.letter}-tier ${row.lane} pick into ${enemy.name}.`
        : `${row.name} is a ${row.letter}-tier ${row.lane} pick this patch.`;
      return { slug: row.slug, name: row.name, score: fit.score, tag, why, reasons: fit.reasons };
    })
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

export type CompNeed = { k: string; v: string; w: string; c: string };

export function compNeeds(allyRoles: string[][]): CompNeed[] {
  const flat = allyRoles.flat().map((role) => role.toLowerCase());
  const front = flat.filter((role) => FRONTLINE.has(role)).length;
  const magic = flat.filter((role) => MAGIC.has(role)).length;
  const filled = allyRoles.filter((roles) => roles.length > 0).length || 1;

  function band(count: number, high: number): { v: string; w: string; c: string } {
    const pct = Math.round((count / Math.max(high, filled)) * 100);
    if (pct >= 70) return { v: 'Covered', w: `${Math.min(100, pct)}%`, c: 'var(--success)' };
    if (pct >= 35) return { v: 'Thin', w: `${pct}%`, c: 'var(--warn)' };
    return { v: 'Missing', w: `${Math.max(12, pct)}%`, c: 'var(--danger)' };
  }

  return [
    { k: 'Frontline', ...band(front, 2) },
    { k: 'Engage', ...band(front, 2) },
    { k: 'Magic damage', ...band(magic, 2) },
  ];
}
