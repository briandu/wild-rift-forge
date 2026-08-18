import { describe, expect, it } from 'vitest';
import { parsePlanId } from './plans';

describe('parsePlanId', () => {
  it('keeps paid tiers and falls back to Free', () => {
    expect(parsePlanId('Squad')).toBe('Squad');
    expect(parsePlanId('Pro')).toBe('Pro');
    expect(parsePlanId('Free')).toBe('Free');
    expect(parsePlanId('enterprise')).toBe('Free');
    expect(parsePlanId(null)).toBe('Free');
  });
});
