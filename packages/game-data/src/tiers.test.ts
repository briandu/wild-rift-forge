import { describe, expect, it } from 'vitest';
import { assignTierLetter, championTierScore, tierBandCounts } from './index';

describe('championTierScore', () => {
  it('weights win rate above pick and ban pressure', () => {
    expect(championTierScore(54, 10, 5)).toBeCloseTo(54 + 1.5 + 0.5);
    expect(championTierScore(52, 20, 20)).toBeGreaterThan(championTierScore(51.5, 2, 0));
  });
});

describe('tierBandCounts', () => {
  it('returns zeros for an empty lane', () => {
    expect(tierBandCounts(0)).toEqual({ S: 0, A: 0, B: 0, C: 0 });
  });

  it('puts a single champion in S', () => {
    expect(tierBandCounts(1)).toEqual({ S: 1, A: 0, B: 0, C: 0 });
  });

  it('uses ~10/20/40 split on a full lane', () => {
    const counts = tierBandCounts(20);
    expect(counts.S).toBe(2);
    expect(counts.A).toBe(4);
    expect(counts.B).toBe(8);
    expect(counts.C).toBe(6);
    expect(counts.S + counts.A + counts.B + counts.C).toBe(20);
  });

  it('never over-assigns relative to n', () => {
    for (let n = 1; n <= 40; n++) {
      const counts = tierBandCounts(n);
      expect(counts.S + counts.A + counts.B + counts.C).toBe(n);
      expect(counts.C).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('assignTierLetter', () => {
  it('maps rank into S then A then B then C', () => {
    const counts = { S: 2, A: 4, B: 8, C: 6 };
    expect(assignTierLetter(1, counts)).toBe('S');
    expect(assignTierLetter(2, counts)).toBe('S');
    expect(assignTierLetter(3, counts)).toBe('A');
    expect(assignTierLetter(6, counts)).toBe('A');
    expect(assignTierLetter(7, counts)).toBe('B');
    expect(assignTierLetter(14, counts)).toBe('B');
    expect(assignTierLetter(15, counts)).toBe('C');
  });
});
