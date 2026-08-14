import { describe, expect, it } from 'vitest';
import { mergeLaneOrder, movePoolItem, poolSortHint, sortPool } from './pool-rank';

const wr: Record<string, number> = { garen: 53.3, gwen: 54, sett: 51.4, darius: 52.6 };
const vol: Record<string, number> = { garen: 8.1, gwen: 11.8, sett: 18.9, darius: 9.4 };

describe('sortPool', () => {
  it('keeps custom order and ranks by win rate or volume', () => {
    const slugs = ['garen', 'gwen', 'sett'];
    expect(sortPool(slugs, 'Custom', (s) => wr[s] ?? 0, (s) => vol[s] ?? 0)).toEqual(slugs);
    expect(sortPool(slugs, 'Win rate', (s) => wr[s] ?? 0, (s) => vol[s] ?? 0)).toEqual([
      'gwen',
      'garen',
      'sett',
    ]);
    expect(sortPool(slugs, 'Games played', (s) => wr[s] ?? 0, (s) => vol[s] ?? 0)).toEqual([
      'sett',
      'gwen',
      'garen',
    ]);
  });
});

describe('movePoolItem', () => {
  it('swaps neighbors and no-ops at the ends', () => {
    expect(movePoolItem(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(movePoolItem(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(movePoolItem(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('mergeLaneOrder', () => {
  it('rewrites only the slugs in the active lane', () => {
    const inLane = (slug: string) => slug === 'garen' || slug === 'darius';
    expect(mergeLaneOrder(['gwen', 'garen', 'sett', 'darius'], ['darius', 'garen'], inLane)).toEqual([
      'gwen',
      'darius',
      'sett',
      'garen',
    ]);
  });
});

describe('poolSortHint', () => {
  it('does not claim personal games when match history is missing', () => {
    expect(poolSortHint('Games played', 'the top lane', true)).toContain('not in yet');
    expect(poolSortHint('Games played', 'the top lane', false)).toContain('Connect a Riot ID');
  });
});
