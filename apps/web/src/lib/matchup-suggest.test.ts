import { describe, expect, it } from 'vitest';
import type { ApiChampion, TierPlacementDto } from './api-types';
import { commonLaneChampions, poolInLane, youLaneSuggestions } from './matchup-suggest';

function champ(slug: string, name: string): ApiChampion {
  return { slug, name, title: null, roles: ['fighter'], difficulty: null, imageUrl: null };
}

function row(slug: string, lane: TierPlacementDto['lane'], pickRate: number): TierPlacementDto {
  return {
    slug,
    name: slug,
    lane,
    letter: 'A',
    score: pickRate,
    rankInLane: 1,
    winRate: 50,
    pickRate,
    banRate: 0,
    thumbnailUrl: null,
    imageUrl: null,
    why: null,
  };
}

const champions = [
  champ('garen', 'Garen'),
  champ('darius', 'Darius'),
  champ('aatrox', 'Aatrox'),
  champ('lulu', 'Lulu'),
];

const placements = [
  row('garen', 'Top', 8),
  row('darius', 'Top', 18),
  row('aatrox', 'Top', 14),
  row('lulu', 'Support', 12),
];

describe('poolInLane', () => {
  it('keeps pool order for champs that play the preferred lane', () => {
    expect(poolInLane(['lulu', 'garen', 'aatrox'], placements, 'Top')).toEqual(['garen', 'aatrox']);
  });

  it('falls back to the full pool when none play that lane', () => {
    expect(poolInLane(['lulu'], placements, 'Top')).toEqual(['lulu']);
  });
});

describe('commonLaneChampions', () => {
  it('ranks same-lane champs by pick rate, not win rate', () => {
    expect(commonLaneChampions(champions, placements, 'Top', [], 3).map((item) => item.slug)).toEqual([
      'darius',
      'aatrox',
      'garen',
    ]);
  });

  it('drops the already-picked champion', () => {
    expect(
      commonLaneChampions(champions, placements, 'Top', ['garen'], 3).map((item) => item.slug),
    ).toEqual(['darius', 'aatrox']);
  });
});

describe('youLaneSuggestions', () => {
  it('puts the pool pick ahead of more-common laners', () => {
    const { fromPool, more } = youLaneSuggestions(
      champions,
      placements,
      'Top',
      ['garen'],
      ['darius'],
      3,
    );
    expect(fromPool.map((item) => item.slug)).toEqual(['garen']);
    expect(more.map((item) => item.slug)).toEqual(['aatrox']);
  });
});
