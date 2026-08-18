import { describe, expect, it } from 'vitest';
import {
  firstPickKnown,
  formatClock,
  guessChampionLanes,
  isFlexPick,
  lockedPickCount,
  phaseChrome,
} from './draft-live';
import { emptyDraftState } from './draft-state';
import type { TierPlacementDto } from './api-types';

function place(
  slug: string,
  lane: TierPlacementDto['lane'],
  pickRate: number,
  score = 50,
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

describe('formatClock', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(24)).toBe('0:24');
    expect(formatClock(252)).toBe('4:12');
  });
});

describe('phaseChrome', () => {
  it('marks your turn during pick-self', () => {
    const chrome = phaseChrome('pick-self', 6);
    expect(chrome.badge).toBe('PICK 6 OF 10 · YOUR TURN');
    expect(chrome.color).toBe('#F0A87B');
  });

  it('stays calm while the other team is picking', () => {
    expect(phaseChrome('pick-enemy', 6).badge).toBe('PICK 6 OF 10');
    expect(phaseChrome('pre-pick', 0).badge).toBe('PRE-PICK');
    expect(phaseChrome('ban', 0).badge).toBe('BANNING');
  });
});

describe('guessChampionLanes', () => {
  it('normalizes pick rates into a lane mix', () => {
    const guesses = guessChampionLanes('riven', [
      place('riven', 'Top', 78),
      place('riven', 'Jungle', 16),
      place('riven', 'Mid', 6),
    ]);
    expect(guesses.map((row) => [row.lane, row.pct])).toEqual([
      ['Top', 78],
      ['Jungle', 16],
      ['Mid', 6],
    ]);
    expect(isFlexPick(guesses)).toBe(true);
  });

  it('treats a single dominant lane as locked-in, not flex', () => {
    const guesses = guessChampionLanes('ashe', [place('ashe', 'Dragon', 94), place('ashe', 'Support', 6)]);
    expect(guesses[0]).toEqual({ lane: 'Dragon', pct: 94 });
    expect(isFlexPick(guesses)).toBe(false);
  });

  it('returns nothing when the champion is unknown', () => {
    expect(guessChampionLanes('riven', [])).toEqual([]);
    expect(guessChampionLanes(null, [place('riven', 'Top', 80)])).toEqual([]);
  });
});

describe('lockedPickCount / firstPickKnown', () => {
  it('counts only locked portraits', () => {
    const state = emptyDraftState();
    state.allies[0] = { lane: 'Top', slug: 'garen' };
    state.allyPrePicks[1] = 'volibear';
    expect(lockedPickCount(state)).toBe(1);
    expect(firstPickKnown(state)).toBe(false);
    state.allyRowLanes = ['Mid', 'Jungle', 'Top', 'Dragon', 'Support'];
    expect(firstPickKnown(state)).toBe(true);
  });
});
