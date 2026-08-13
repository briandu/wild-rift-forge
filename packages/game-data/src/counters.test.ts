import { describe, expect, it } from 'vitest';
import { buildLaneCounters, counterScore, matchupVerdict, pickEnemyLane } from './counters';
import type { LaneStatRow } from './counters';
import {
  banLift,
  compGaps,
  compNeeds,
  draftFitScore,
  rankDraftSuggestions,
  traitsForRoles,
  type DraftPlacement,
} from './draft';

const rows: LaneStatRow[] = [
  { slug: 'sett', name: 'Sett', lane: 'Top', winRate: 51.4, pickRate: 18, banRate: 9, imageUrl: null, thumbnailUrl: null },
  { slug: 'volibear', name: 'Volibear', lane: 'Top', winRate: 56.2, pickRate: 14, banRate: 11, imageUrl: null, thumbnailUrl: null },
  { slug: 'gwen', name: 'Gwen', lane: 'Top', winRate: 54.0, pickRate: 11, banRate: 7, imageUrl: null, thumbnailUrl: null },
  { slug: 'nasus', name: 'Nasus', lane: 'Top', winRate: 44.1, pickRate: 6, banRate: 2, imageUrl: null, thumbnailUrl: null },
  { slug: 'ahri', name: 'Ahri', lane: 'Mid', winRate: 52.0, pickRate: 20, banRate: 8, imageUrl: null, thumbnailUrl: null },
];

describe('counterScore', () => {
  it('raises the score when the other champion wins more often', () => {
    expect(counterScore(56.2, 51.4)).toBeGreaterThan(counterScore(51.4, 56.2));
    expect(counterScore(56.2, 51.4)).toBeGreaterThanOrEqual(40);
    expect(counterScore(56.2, 51.4)).toBeLessThanOrEqual(95);
  });
});

describe('pickEnemyLane', () => {
  it('uses the lane with the highest pick rate', () => {
    expect(pickEnemyLane(rows, 'sett')).toBe('Top');
  });

  it('honours a preferred lane when the champion is played there', () => {
    expect(pickEnemyLane(rows, 'sett', 'Top')).toBe('Top');
  });
});

describe('buildLaneCounters', () => {
  it('lists higher-WR lane mates as counters and lower-WR as beats', () => {
    const result = buildLaneCounters('sett', rows);
    expect(result.lane).toBe('Top');
    expect(result.picks[0]?.slug).toBe('volibear');
    expect(result.picks[0]?.tag).toBe('STRONG COUNTER');
    expect(result.beats.some((row) => row.slug === 'nasus')).toBe(true);
    expect(result.picks.every((row) => row.slug !== 'sett')).toBe(true);
  });
});

describe('matchupVerdict', () => {
  it('favours the higher win-rate side', () => {
    expect(matchupVerdict(56, 51).side).toBe('you');
    expect(matchupVerdict(51, 56).side).toBe('them');
    expect(matchupVerdict(51, 51.2).side).toBe('even');
  });
});

const volibear: DraftPlacement = {
  slug: 'volibear',
  name: 'Volibear',
  lane: 'Top',
  letter: 'S',
  score: 70,
  winRate: 56,
  roles: ['fighter'],
};
const gwen: DraftPlacement = {
  slug: 'gwen',
  name: 'Gwen',
  lane: 'Top',
  letter: 'A',
  score: 60,
  winRate: 54,
  roles: ['fighter'],
};
const nasus: DraftPlacement = {
  slug: 'nasus',
  name: 'Nasus',
  lane: 'Top',
  letter: 'C',
  score: 40,
  winRate: 44,
  roles: ['fighter'],
};
const lanePool = [volibear, gwen, nasus];

describe('draftFitScore', () => {
  it('boosts pool members and higher WR into the lane opponent', () => {
    const enemy: DraftPlacement = { ...volibear, slug: 'sett', name: 'Sett', letter: 'B', winRate: 51.4, score: 50 };
    const pooled = draftFitScore(volibear, { enemy, pool: new Set(['volibear']) });
    const raw = draftFitScore(volibear, { enemy });
    expect(pooled.score).toBeGreaterThan(raw.score);
    expect(pooled.reasons).toContain('In your pool');
  });

  it('rewards a candidate whose stronger lane rivals are banned', () => {
    const bans = new Set(['volibear']);
    const lifted = draftFitScore(gwen, { bans }, lanePool);
    const plain = draftFitScore(gwen, {}, lanePool);
    expect(lifted.score).toBeGreaterThan(plain.score);
    expect(lifted.reasons).toContain('Bans opened this lane');
  });

  it('ignores bans that only remove weaker lane rivals', () => {
    const result = draftFitScore(gwen, { bans: new Set(['nasus']) }, lanePool);
    expect(result.reasons).not.toContain('Bans opened this lane');
  });

  it('rewards filling a trait the locked allies are missing', () => {
    const allyRoles = [['marksman'], ['marksman']];
    const filling = draftFitScore(volibear, { allyRoles });
    const plain = draftFitScore(volibear, {});
    expect(filling.score).toBeGreaterThan(plain.score);
    expect(filling.reasons.some((reason) => reason.startsWith('Fills your'))).toBe(true);
  });
});

describe('banLift', () => {
  it('counts only banned champions scoring above the candidate', () => {
    expect(banLift(gwen, lanePool, new Set(['volibear', 'nasus']))).toBe(1);
    expect(banLift(volibear, lanePool, new Set(['gwen']))).toBe(0);
    expect(banLift(gwen, lanePool, new Set())).toBe(0);
  });
});

describe('rankDraftSuggestions', () => {
  it('skips taken champions and returns a capped list', () => {
    const suggestions = rankDraftSuggestions(
      lanePool,
      { pool: new Set(['gwen']), taken: new Set(['volibear']) },
      2,
    );
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]?.slug).toBe('gwen');
  });

  it('explains when bans cleared the lane', () => {
    const bans = new Set(['volibear']);
    const suggestions = rankDraftSuggestions(lanePool, { bans, taken: bans }, 3);
    expect(suggestions[0]?.slug).toBe('gwen');
    expect(suggestions[0]?.why).toContain('bans cleared');
  });
});

describe('traitsForRoles', () => {
  it('maps roles onto comp traits and ignores unknown roles', () => {
    expect(traitsForRoles(['tank']).frontline).toBeGreaterThan(0);
    expect(traitsForRoles(['marksman']).frontline).toBe(0);
    expect(traitsForRoles(['marksman']).physical).toBeGreaterThan(0);
    expect(traitsForRoles(['bard']).magic).toBe(0);
  });
});

describe('compNeeds', () => {
  it('marks frontline missing when the team is all marksmen', () => {
    const needs = compNeeds([['marksman'], ['marksman']]);
    expect(needs[0]?.trait).toBe('frontline');
    expect(needs[0]?.status).toBe('Missing');
  });

  it('marks frontline covered with a tank and a fighter', () => {
    const needs = compNeeds([['tank'], ['fighter']]);
    expect(needs[0]?.status).toBe('Covered');
  });

  it('separates engage from frontline', () => {
    const needs = compNeeds([['mage'], ['mage']]);
    const engage = needs.find((need) => need.trait === 'engage');
    const magic = needs.find((need) => need.trait === 'magic');
    expect(engage?.status).toBe('Missing');
    expect(magic?.status).toBe('Covered');
  });
});

describe('compGaps', () => {
  it('orders the worst-covered traits first', () => {
    const gaps = compGaps([['marksman'], ['marksman']]);
    expect(gaps).toContain('frontline');
    expect(gaps).toContain('magic');
    expect(gaps).not.toContain('physical');
  });
});
