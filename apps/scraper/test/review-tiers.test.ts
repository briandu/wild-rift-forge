import { describe, expect, it } from 'vitest';
import {
  fingerprintReview,
  parseReviewAdjustments,
  pickReviewCandidates,
  type ReviewCandidate,
} from '../src/jobs/review-tiers';
import type { StoredTierPlacement } from '@wild-rift-forge/database';

function placement(partial: Partial<StoredTierPlacement> & Pick<StoredTierPlacement, 'slug' | 'letter'>): StoredTierPlacement {
  return {
    snapshotDate: '2026-08-13',
    championId: 1,
    lane: 'Mid',
    rankBracket: 'diamond_plus',
    score: 52,
    rankInLane: 1,
    winRate: 52,
    pickRate: 4,
    banRate: 2,
    ruleset: 'blended_v1',
    adjustedWinRate: 50.5,
    skillSpread: -1,
    confidence: 0.4,
    previousLetter: null,
    name: partial.slug,
    thumbnailUrl: null,
    imageUrl: null,
    why: null,
    ...partial,
  };
}

describe('pickReviewCandidates', () => {
  it('prioritizes surprising S-tier and patch-touched champs', () => {
    const picked = pickReviewCandidates(
      [
        placement({ slug: 'teemo', letter: 'S', adjustedWinRate: 50.9, championId: 1 }),
        placement({ slug: 'ahri', letter: 'B', adjustedWinRate: 51, championId: 2, rankInLane: 12 }),
        placement({ slug: 'nasus', letter: 'A', championId: 3, rankInLane: 4 }),
      ],
      new Set(['nasus']),
      2,
    );
    expect(picked.map((row) => row.slug)).toEqual(['teemo', 'nasus']);
  });
});

describe('parseReviewAdjustments', () => {
  it('drops keep and unknown slugs', () => {
    const parsed = parseReviewAdjustments(
      {
        adjustments: [
          { slug: 'teemo', lane: 'Mid', direction: 'down', reason: 'Low-elo inflate', confidence: 'high' },
          { slug: 'teemo', lane: 'Mid', direction: 'keep', reason: 'Fine', confidence: 'low' },
          { slug: 'unknown', lane: 'Mid', direction: 'up', reason: 'Nope', confidence: 'high' },
        ],
      },
      new Set(['teemo:Mid']),
    );
    expect(parsed).toEqual([
      { slug: 'teemo', lane: 'Mid', direction: 'down', reason: 'Low-elo inflate', confidence: 'high' },
    ]);
  });
});

describe('fingerprintReview', () => {
  const candidate: ReviewCandidate = {
    slug: 'teemo',
    name: 'Teemo',
    lane: 'Mid',
    letter: 'S',
    rankInLane: 2,
    winRate: 52,
    pickRate: 3,
    banRate: 20,
    adjustedWinRate: 50.9,
    skillSpread: -2,
    confidence: 0.4,
    patchTouched: false,
  };

  it('changes when the model changes', () => {
    expect(fingerprintReview('7.2c', 'gpt-5.6-sol', [candidate])).not.toBe(
      fingerprintReview('7.2c', 'gpt-4o-mini', [candidate]),
    );
  });
});
