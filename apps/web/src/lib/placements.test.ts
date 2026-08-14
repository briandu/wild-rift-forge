import { describe, expect, it } from 'vitest';
import type { TierPlacementDto } from './api-types';
import {
  bestPlacement,
  laneFromLabel,
  mostPicked,
  mostPickedByLane,
  parseTierLane,
  formatSnapshotDate,
  patchNoteLine,
  placementsForSlug,
  uniqueBestPlacements,
} from './placements';

function row(
  slug: string,
  lane: TierPlacementDto['lane'],
  pickRate: number,
  score = pickRate,
): TierPlacementDto {
  return {
    slug,
    name: slug,
    lane,
    letter: 'A',
    score,
    rankInLane: 1,
    winRate: 50,
    pickRate,
    banRate: 0,
    thumbnailUrl: null,
    imageUrl: null,
    why: null,
  };
}

describe('parseTierLane', () => {
  it('accepts exact lane names, ignoring case', () => {
    expect(parseTierLane('dragon')).toBe('Dragon');
    expect(parseTierLane('Support')).toBe('Support');
    expect(parseTierLane('baron')).toBeUndefined();
  });
});

describe('laneFromLabel', () => {
  it('reads the counters payload labels', () => {
    expect(laneFromLabel('TOP LANE')).toBe('Top');
    expect(laneFromLabel('JUNGLE')).toBe('Jungle');
    expect(laneFromLabel('unknown')).toBeUndefined();
  });
});

describe('bestPlacement', () => {
  it('prefers the requested lane, then highest score', () => {
    const rows = [row('gwen', 'Jungle', 8, 40), row('gwen', 'Top', 12, 70)];
    expect(bestPlacement(rows, 'Jungle')?.lane).toBe('Jungle');
    expect(bestPlacement(rows)?.lane).toBe('Top');
  });

  it('walks a role order when a champion plays more than one lane', () => {
    const rows = [row('gwen', 'Jungle', 8, 80), row('gwen', 'Top', 12, 40)];
    expect(bestPlacement(rows, ['Mid', 'Top', 'Jungle'])?.lane).toBe('Top');
  });
});

describe('uniqueBestPlacements', () => {
  it('keeps one row per champion', () => {
    const unique = uniqueBestPlacements([
      row('gwen', 'Top', 10, 40),
      row('gwen', 'Jungle', 4, 80),
      row('sett', 'Top', 20, 50),
    ]);
    expect(unique).toHaveLength(2);
    expect(unique.find((item) => item.slug === 'gwen')?.lane).toBe('Jungle');
  });
});

describe('mostPicked', () => {
  it('orders unique champions by pick rate', () => {
    const picked = mostPicked(
      [row('gwen', 'Top', 11), row('sett', 'Top', 19), row('gwen', 'Jungle', 3)],
      1,
    );
    expect(picked.map((item) => item.slug)).toEqual(['sett']);
  });
});

describe('mostPickedByLane', () => {
  it('returns lane order with the highest pick rate in each', () => {
    const leaders = mostPickedByLane([
      row('gwen', 'Top', 10),
      row('sett', 'Top', 22),
      row('lee-sin', 'Jungle', 18),
    ]);
    expect(leaders.map((item) => `${item.lane}:${item.slug}`)).toEqual([
      'Top:sett',
      'Jungle:lee-sin',
    ]);
  });
});

describe('placementsForSlug', () => {
  it('filters to one champion', () => {
    expect(placementsForSlug([row('gwen', 'Top', 10), row('sett', 'Top', 8)], 'gwen')).toHaveLength(
      1,
    );
  });
});

describe('formatSnapshotDate', () => {
  it('formats an ISO date without inventing a patch', () => {
    expect(formatSnapshotDate('2026-08-12')).toBe('12 AUG');
    expect(formatSnapshotDate(null)).toBeNull();
  });
});

describe('patchNoteLine', () => {
  it('names the change without inventing a win-rate', () => {
    expect(
      patchNoteLine(
        { name: 'Gwen', slug: 'gwen', kind: 'BUFF', wr: null, wrShift: null, lines: [] },
        '7.2b',
      ),
    ).toBe('Buffed in 7.2b');
    expect(patchNoteLine(undefined, '7.2b')).toBeUndefined();
  });
});
