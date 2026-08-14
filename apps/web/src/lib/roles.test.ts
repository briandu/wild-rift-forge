import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_ORDER,
  normalizeRoleOrder,
  preferredLaneOf,
  preferredSharedLane,
  roleCountLabel,
  roleRankTag,
} from './roles';

describe('normalizeRoleOrder', () => {
  it('fills missing lanes and drops junk without inventing a new order', () => {
    expect(normalizeRoleOrder(['Jungle', 'Top', 'Jungle', 'Baron'])).toEqual([
      'Jungle',
      'Top',
      'Mid',
      'Dragon',
      'Support',
    ]);
    expect(normalizeRoleOrder(null)).toEqual(DEFAULT_ROLE_ORDER);
  });
});

describe('preferredLaneOf', () => {
  it('picks the first role the champion actually plays', () => {
    expect(preferredLaneOf(['Mid', 'Top'], ['Jungle', 'Top', 'Mid'])).toBe('Top');
    expect(preferredLaneOf(['Support'], DEFAULT_ROLE_ORDER)).toBe('Support');
    expect(preferredLaneOf([])).toBeUndefined();
  });
});

describe('preferredSharedLane', () => {
  it('prefers a shared lane, then the first champ role order', () => {
    expect(preferredSharedLane(['Top', 'Jungle'], ['Jungle', 'Mid'], ['Mid', 'Jungle', 'Top'])).toBe(
      'Jungle',
    );
    expect(preferredSharedLane(['Top'], ['Mid'], ['Jungle', 'Mid', 'Top'])).toBe('Top');
  });
});

describe('role labels', () => {
  it('tags the first two roles and pluralizes the pool count', () => {
    expect(roleRankTag(0)).toBe('PRIMARY');
    expect(roleRankTag(1)).toBe('SECONDARY');
    expect(roleRankTag(2)).toBe('FILL');
    expect(roleCountLabel(1)).toBe('1 champion in your pool');
    expect(roleCountLabel(3)).toBe('3 champions in your pool');
  });
});
