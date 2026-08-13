import { describe, expect, it } from 'vitest';
import { buildLaneCounters, counterScore, matchupVerdict, pickEnemyLane } from './counters';
import type { LaneStatRow } from './counters';
import { compNeeds, draftFitScore, rankDraftSuggestions } from './draft';

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

describe('draftFitScore', () => {
  it('boosts pool members and higher WR into the lane opponent', () => {
    const candidate = {
      slug: 'volibear',
      name: 'Volibear',
      lane: 'Top' as const,
      letter: 'S' as const,
      score: 60,
      winRate: 56.2,
      roles: ['fighter'],
    };
    const enemy = { ...candidate, slug: 'sett', name: 'Sett', letter: 'B' as const, winRate: 51.4, score: 50 };
    const pooled = draftFitScore(candidate, enemy, true);
    const raw = draftFitScore(candidate, enemy, false);
    expect(pooled.score).toBeGreaterThan(raw.score);
    expect(pooled.reasons).toContain('In your pool');
  });
});

describe('rankDraftSuggestions', () => {
  it('skips taken champions and returns a capped list', () => {
    const suggestions = rankDraftSuggestions(
      [
        { slug: 'volibear', name: 'Volibear', lane: 'Top', letter: 'S', score: 70, winRate: 56, roles: ['fighter'] },
        { slug: 'gwen', name: 'Gwen', lane: 'Top', letter: 'A', score: 60, winRate: 54, roles: ['fighter'] },
        { slug: 'nasus', name: 'Nasus', lane: 'Top', letter: 'C', score: 40, winRate: 44, roles: ['fighter'] },
      ],
      null,
      new Set(['gwen']),
      new Set(['volibear']),
      2,
    );
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]?.slug).toBe('gwen');
  });
});

describe('compNeeds', () => {
  it('marks frontline missing when the team is all marksmen', () => {
    const needs = compNeeds([['marksman'], ['marksman']]);
    expect(needs[0]?.v).toBe('Missing');
  });

  it('marks frontline covered with two tanks', () => {
    const needs = compNeeds([['tank'], ['fighter']]);
    expect(needs[0]?.v).toBe('Covered');
  });
});
