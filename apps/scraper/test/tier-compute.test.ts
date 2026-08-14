import { describe, expect, it } from 'vitest';
import { placementsFromBlended, placementsFromCnStats } from '../src/tiers/compute';

const base = {
  snapshotDate: '2026-08-14',
  lane: 'Mid' as const,
  rankBracket: 'diamond_plus' as const,
};

describe('placementsFromCnStats / placementsFromBlended', () => {
  it('keeps a low-sample high WR champion out of S in blended_v1', () => {
    const snapshots = [
      { ...base, championId: 1, winRate: 56, pickRate: 0.3, banRate: 0 },
      { ...base, championId: 2, winRate: 53, pickRate: 12, banRate: 8 },
      { ...base, championId: 3, winRate: 52, pickRate: 8, banRate: 2 },
      { ...base, championId: 4, winRate: 51, pickRate: 6, banRate: 1 },
      { ...base, championId: 5, winRate: 50, pickRate: 5, banRate: 0 },
      { ...base, championId: 1, rankBracket: 'challenger_plus' as const, winRate: 58, pickRate: 0.2, banRate: 0 },
      { ...base, championId: 1, rankBracket: 'all' as const, winRate: 54, pickRate: 0.4, banRate: 0 },
      { ...base, championId: 2, rankBracket: 'challenger_plus' as const, winRate: 53.2, pickRate: 11, banRate: 8 },
      { ...base, championId: 2, rankBracket: 'all' as const, winRate: 52.8, pickRate: 13, banRate: 7 },
    ];

    const legacy = placementsFromCnStats(snapshots.filter((row) => row.rankBracket === 'diamond_plus'));
    const blended = placementsFromBlended({
      snapshots,
      bracket: 'diamond_plus',
      previous: [],
      nudgeByChampion: new Map(),
    });

    const legacyOneTrick = legacy.find((row) => row.championId === 1);
    const blendedOneTrick = blended.find((row) => row.championId === 1);
    const blendedContested = blended.find((row) => row.championId === 2);

    expect(legacyOneTrick?.letter).toBe('S');
    expect(blendedOneTrick?.letter).not.toBe('S');
    expect(blendedContested?.rankInLane).toBeLessThan(blendedOneTrick?.rankInLane ?? 99);
  });
});
