import { describe, expect, it } from 'vitest';
import {
  fingerprintExplanation,
  parseExplanations,
  signalNotes,
  type ExplanationFact,
} from '../src/jobs/explain-tiers';

const fact: ExplanationFact = {
  slug: 'teemo',
  name: 'Teemo',
  lane: 'Mid',
  letter: 'S',
  rankInLane: 3,
  winRate: 54.2,
  pickRate: 8.1,
  banRate: 4.2,
  adjustedWinRate: 53.4,
  skillSpread: -2.1,
  confidence: 0.82,
  score: 54.1,
  previousLetter: 'A',
  patchLines: [],
  signals: ['Trusted sample: 8.1% pick rate.'],
};

describe('fingerprintExplanation', () => {
  it('is stable for the same facts', () => {
    expect(fingerprintExplanation(fact)).toBe(fingerprintExplanation(fact));
  });

  it('changes when the letter changes', () => {
    expect(fingerprintExplanation({ ...fact, letter: 'A' })).not.toBe(fingerprintExplanation(fact));
  });

  it('changes when the explainer model changes', () => {
    expect(fingerprintExplanation(fact, 'gpt-5.6-sol')).not.toBe(
      fingerprintExplanation(fact, 'gpt-4o-mini'),
    );
  });
});

describe('signalNotes', () => {
  it('calls out a Challenger-only champion', () => {
    const notes = signalNotes({
      winRate: 51,
      pickRate: 6,
      banRate: 2,
      adjustedWinRate: 51,
      skillSpread: 3.2,
      confidence: 0.7,
      letter: 'B',
      previousLetter: 'A',
    });
    expect(notes.some((note) => note.includes('Challenger'))).toBe(true);
    expect(notes.some((note) => note.includes('Moved from'))).toBe(false);
  });
});

describe('parseExplanations', () => {
  it('keeps only roster-valid slug/lane pairs', () => {
    const parsed = parseExplanations(
      {
        explanations: [
          { slug: 'teemo', lane: 'Mid', why: 'Teemo is S because a trusted pick-rate sample still holds a 53% adjusted win rate.' },
          { slug: 'unknown', lane: 'Mid', why: 'Nope.' },
          { slug: 'teemo', lane: 'Top', why: 'Gwen is A tier after moving up from B in the prior snapshot.' },
        ],
      },
      new Set(['teemo:Mid']),
    );
    expect(parsed).toEqual([
      {
        slug: 'teemo',
        lane: 'Mid',
        why: 'Teemo is S because a trusted pick-rate sample still holds a 53% adjusted win rate.',
      },
    ]);
  });
});
