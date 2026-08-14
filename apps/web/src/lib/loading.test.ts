import { describe, expect, it } from 'vitest';
import { holdRemainingMs, skeletonDelay, SKELETON_HOLD_MS, SKELETON_STAGGER_CAP_S } from './loading';

describe('skeletonDelay', () => {
  it('staggers 60ms per row', () => {
    expect(skeletonDelay(0)).toBe('0s');
    expect(skeletonDelay(1)).toBe('0.06s');
    expect(skeletonDelay(4)).toBe('0.24s');
  });

  it('caps the wave at 300ms so long tables stay one sweep', () => {
    expect(skeletonDelay(5)).toBe(`${SKELETON_STAGGER_CAP_S}s`);
    expect(skeletonDelay(40)).toBe(`${SKELETON_STAGGER_CAP_S}s`);
  });
});

describe('holdRemainingMs', () => {
  it('holds a visible skeleton for at least 400ms', () => {
    expect(holdRemainingMs(0)).toBe(SKELETON_HOLD_MS);
    expect(holdRemainingMs(120)).toBe(280);
    expect(holdRemainingMs(400)).toBe(0);
    expect(holdRemainingMs(900)).toBe(0);
  });
});
