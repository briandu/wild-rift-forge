import { describe, expect, it } from 'vitest';
import { draftFitScore } from './draft';
import {
  applyLetterAdjustment,
  assignTierLetter,
  assignTierLetterHybrid,
  assignTierLetterWithHysteresis,
  BAN_RATE_CAP,
  championTierScore,
  compositeTierScore,
  daysSincePatch,
  HYSTERESIS_MARGIN,
  PATCH_NUDGE_CAP,
  PATCH_NUDGE_DECAY_DAYS,
  patchChangeSign,
  patchNudge,
  SHRINKAGE_K,
  SKILL_SPREAD_CAP,
  shrinkWinRate,
  skillSpreadAdjustment,
  TIER_SCORE_FLOORS,
  tierBandCounts,
} from './tiers';

describe('championTierScore', () => {
  it('weights win rate above pick and ban pressure', () => {
    expect(championTierScore(54, 10, 5)).toBeCloseTo(54 + 1.5 + 0.5);
    expect(championTierScore(52, 20, 20)).toBeGreaterThan(championTierScore(51.5, 2, 0));
  });
});

describe('tierBandCounts', () => {
  it('returns zeros for an empty lane', () => {
    expect(tierBandCounts(0)).toEqual({ 'S+': 0, S: 0, A: 0, B: 0, C: 0 });
  });

  it('puts a single champion in S', () => {
    expect(tierBandCounts(1)).toEqual({ 'S+': 0, S: 1, A: 0, B: 0, C: 0 });
  });

  it('uses ~5/10/20/40 split on a full lane', () => {
    const counts = tierBandCounts(20);
    expect(counts['S+']).toBe(1);
    expect(counts.S).toBe(2);
    expect(counts.A).toBe(4);
    expect(counts.B).toBe(8);
    expect(counts.C).toBe(5);
    expect(counts['S+'] + counts.S + counts.A + counts.B + counts.C).toBe(20);
  });

  it('never over-assigns relative to n', () => {
    for (let n = 1; n <= 40; n++) {
      const counts = tierBandCounts(n);
      expect(counts['S+'] + counts.S + counts.A + counts.B + counts.C).toBe(n);
      expect(counts.C).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('assignTierLetter', () => {
  it('maps rank into S+ then S then A then B then C', () => {
    const counts = { 'S+': 1, S: 2, A: 4, B: 8, C: 5 };
    expect(assignTierLetter(1, counts)).toBe('S+');
    expect(assignTierLetter(2, counts)).toBe('S');
    expect(assignTierLetter(3, counts)).toBe('S');
    expect(assignTierLetter(4, counts)).toBe('A');
    expect(assignTierLetter(7, counts)).toBe('A');
    expect(assignTierLetter(8, counts)).toBe('B');
    expect(assignTierLetter(15, counts)).toBe('B');
    expect(assignTierLetter(16, counts)).toBe('C');
  });
});

describe('shrinkWinRate', () => {
  it('barely trusts a 0.3% pick-rate sample', () => {
    const weight = 0.3 / (0.3 + SHRINKAGE_K);
    expect(weight).toBeCloseTo(0.146, 2);
    expect(shrinkWinRate(54, 0.3, 50)).toBeCloseTo(50 + 4 * weight);
  });

  it('mostly trusts a 10% pick-rate sample', () => {
    const weight = 10 / (10 + SHRINKAGE_K);
    expect(weight).toBeCloseTo(0.851, 2);
    expect(shrinkWinRate(54, 10, 50)).toBeCloseTo(50 + 4 * weight);
  });
});

describe('skillSpreadAdjustment', () => {
  it('caps a large positive Challenger spread', () => {
    expect(skillSpreadAdjustment(10)).toBe(-SKILL_SPREAD_CAP);
  });

  it('caps a large negative Challenger spread', () => {
    expect(skillSpreadAdjustment(-10)).toBe(SKILL_SPREAD_CAP);
  });
});

describe('patchNudge', () => {
  it('is full strength on patch day', () => {
    expect(patchNudge(1, 0)).toBe(PATCH_NUDGE_CAP);
    expect(patchNudge(-1, 0)).toBe(-PATCH_NUDGE_CAP);
  });

  it('decays to zero at the horizon', () => {
    expect(patchNudge(1, PATCH_NUDGE_DECAY_DAYS)).toBe(0);
    expect(patchNudge(1, PATCH_NUDGE_DECAY_DAYS + 3)).toBe(0);
  });

  it('is partial mid-window', () => {
    expect(patchNudge(1, 4)).toBeCloseTo(PATCH_NUDGE_CAP * (1 - 4 / PATCH_NUDGE_DECAY_DAYS));
  });

  it('nets mixed patch lines to a sign', () => {
    expect(patchChangeSign(['buff', 'buff', 'nerf'])).toBe(1);
    expect(patchChangeSign(['nerf', 'adjustment'])).toBe(-1);
    expect(patchChangeSign(['buff', 'nerf'])).toBe(0);
    expect(patchChangeSign(['rework'])).toBe(0);
  });

  it('treats a missing release date as day zero', () => {
    expect(daysSincePatch(null, '2026-08-14')).toBe(0);
    expect(daysSincePatch('2026-08-07', '2026-08-14')).toBe(7);
  });
});

describe('assignTierLetterHybrid', () => {
  it('suppresses S+ and S in a weak lane even when rank is 1', () => {
    const counts = tierBandCounts(20);
    expect(assignTierLetter(1, counts)).toBe('S+');
    expect(assignTierLetterHybrid(1, counts, 51)).toBe('A');
    expect(assignTierLetterHybrid(1, counts, TIER_SCORE_FLOORS.S)).toBe('S');
    expect(assignTierLetterHybrid(1, counts, TIER_SCORE_FLOORS['S+'])).toBe('S+');
  });

  it('cascades down when the score misses several floors', () => {
    const counts = tierBandCounts(20);
    expect(assignTierLetterHybrid(1, counts, 47)).toBe('C');
  });
});

describe('assignTierLetterWithHysteresis', () => {
  it('holds A when the S crossing is only marginal', () => {
    const score = TIER_SCORE_FLOORS.S + HYSTERESIS_MARGIN - 0.05;
    expect(assignTierLetterWithHysteresis('S', 'A', score)).toBe('A');
  });

  it('promotes once the floor plus margin is cleared', () => {
    const score = TIER_SCORE_FLOORS.S + HYSTERESIS_MARGIN;
    expect(assignTierLetterWithHysteresis('S', 'A', score)).toBe('S');
  });

  it('holds S when the demotion is only marginal', () => {
    const score = TIER_SCORE_FLOORS.S - HYSTERESIS_MARGIN + 0.05;
    expect(assignTierLetterWithHysteresis('A', 'S', score)).toBe('S');
  });

  it('demotes once the previous floor minus margin is crossed', () => {
    const score = TIER_SCORE_FLOORS.S - HYSTERESIS_MARGIN;
    expect(assignTierLetterWithHysteresis('A', 'S', score)).toBe('A');
  });

  it('lets a two-letter jump through without a hold', () => {
    expect(assignTierLetterWithHysteresis('S', 'C', 51)).toBe('S');
  });
});

describe('ban contribution', () => {
  it('caps a huge ban rate so it cannot manufacture an S tier', () => {
    const uncapped = compositeTierScore({
      winRate: 47.5,
      pickRate: 10,
      banRate: 40,
      laneMeanWinRate: 50,
      challengerWinRate: 46,
      allWinRate: 48,
      patchNudge: 0,
    });
    const noBan = compositeTierScore({
      winRate: 47.5,
      pickRate: 10,
      banRate: 0,
      laneMeanWinRate: 50,
      challengerWinRate: 46,
      allWinRate: 48,
      patchNudge: 0,
    });
    expect(uncapped.score - noBan.score).toBeCloseTo(BAN_RATE_CAP);
    expect(uncapped.score).toBeLessThan(TIER_SCORE_FLOORS.S);
  });
});

describe('compositeTierScore scale', () => {
  it('stays on a win-rate-like scale that draftFitScore can consume', () => {
    const result = compositeTierScore({
      winRate: 54,
      pickRate: 10,
      banRate: 5,
      laneMeanWinRate: 50,
      challengerWinRate: 56,
      allWinRate: 52,
      patchNudge: 0.5,
    });
    expect(result.score).toBeGreaterThan(45);
    expect(result.score).toBeLessThan(60);

    const fit = draftFitScore(
      {
        slug: 'ahri',
        name: 'Ahri',
        lane: 'Mid',
        letter: 'A',
        score: result.score,
        winRate: 54,
        roles: ['mage'],
      },
      {},
    );
    expect(fit.score).toBeGreaterThanOrEqual(40);
    expect(fit.score).toBeLessThanOrEqual(99);
  });
});

describe('applyLetterAdjustment', () => {
  it('clamps to one letter toward S+ or C', () => {
    expect(applyLetterAdjustment('A', 1)).toBe('S');
    expect(applyLetterAdjustment('S', 1)).toBe('S+');
    expect(applyLetterAdjustment('A', -1)).toBe('B');
    expect(applyLetterAdjustment('S+', 1)).toBe('S+');
    expect(applyLetterAdjustment('C', -1)).toBe('C');
    expect(applyLetterAdjustment('B', 4)).toBe('A');
  });
});
