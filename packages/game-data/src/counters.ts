import type { TierLane } from './index';

export type LaneStatRow = {
  slug: string;
  name: string;
  lane: TierLane;
  winRate: number;
  pickRate: number;
  banRate: number;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

export type CounterPickResult = {
  slug: string;
  name: string;
  score: number;
  winRate: string;
  tag: 'STRONG COUNTER' | 'GOOD COUNTER';
  why: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

export type AlsoPickResult = {
  slug: string;
  name: string;
  score: number;
  winRate: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

/** Lane-strength delta → 40–95 draft/counter score. Not a pairwise win rate. */
export function counterScore(otherWinRate: number, enemyWinRate: number): number {
  return Math.max(40, Math.min(95, Math.round(55 + (otherWinRate - enemyWinRate) * 6)));
}

export function formatWinRate(winRate: number): string {
  return `${winRate.toFixed(1)}%`;
}

export function pickEnemyLane(rows: LaneStatRow[], enemySlug: string, preferred?: TierLane): TierLane {
  const own = rows.filter((row) => row.slug === enemySlug);
  if (preferred && own.some((row) => row.lane === preferred)) {
    return preferred;
  }
  const best = [...own].sort((a, b) => b.pickRate - a.pickRate)[0];
  return best?.lane ?? preferred ?? 'Top';
}

function whyFor(other: LaneStatRow, enemy: LaneStatRow): string {
  const delta = other.winRate - enemy.winRate;
  if (delta >= 3) {
    return `Wins this lane ${delta.toFixed(1)} points more often than ${enemy.name} this patch.`;
  }
  if (delta > 0) {
    return `Slightly ahead of ${enemy.name} on ${other.lane} win rate this patch.`;
  }
  return `One of the stronger ${other.lane} picks even though ${enemy.name} is close on win rate.`;
}

export function buildLaneCounters(
  enemySlug: string,
  rows: LaneStatRow[],
  preferredLane?: TierLane,
): {
  lane: TierLane;
  enemy: LaneStatRow | null;
  picks: CounterPickResult[];
  also: AlsoPickResult[];
  beats: AlsoPickResult[];
} {
  const lane = pickEnemyLane(rows, enemySlug, preferredLane);
  const inLane = rows.filter((row) => row.lane === lane);
  const enemy = inLane.find((row) => row.slug === enemySlug) ?? null;
  const enemyWr = enemy?.winRate ?? 50;
  const others = inLane
    .filter((row) => row.slug !== enemySlug)
    .sort((a, b) => b.winRate - a.winRate);

  const toAlso = (row: LaneStatRow): AlsoPickResult => ({
    slug: row.slug,
    name: row.name,
    score: counterScore(row.winRate, enemyWr),
    winRate: formatWinRate(row.winRate),
    imageUrl: row.imageUrl,
    thumbnailUrl: row.thumbnailUrl,
  });

  const toPick = (row: LaneStatRow): CounterPickResult => ({
    ...toAlso(row),
    tag: row.winRate - enemyWr >= 2 ? 'STRONG COUNTER' : 'GOOD COUNTER',
    why: enemy ? whyFor(row, enemy) : `Strong ${lane} pick this patch.`,
  });

  const ahead = others.filter((row) => row.winRate >= enemyWr);
  const fill = others.filter((row) => row.winRate < enemyWr);
  const ranked = [...ahead, ...fill];
  const picks = ranked.slice(0, 3).map(toPick);
  const also = ranked.slice(3, 7).map(toAlso);
  const beats = [...others].sort((a, b) => a.winRate - b.winRate).slice(0, 6).map(toAlso);

  return { lane, enemy, picks, also, beats };
}

export type MatchupSide = 'you' | 'them' | 'even';

export function matchupVerdict(
  youWinRate: number,
  themWinRate: number,
): { side: MatchupSide; difficulty: string; score: number } {
  const delta = youWinRate - themWinRate;
  const score = Math.max(1, Math.min(9, Number((5 - delta * 0.7).toFixed(1))));
  if (delta >= 1.5) {
    return { side: 'you', difficulty: 'Easy', score };
  }
  if (delta <= -1.5) {
    return { side: 'them', difficulty: 'Hard', score };
  }
  return { side: 'even', difficulty: 'Medium', score };
}
