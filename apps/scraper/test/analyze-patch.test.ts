import { describe, expect, it } from 'vitest';
import { analysisIsCurrent, fingerprintPatchNotes } from '../src/jobs/analyze-patch';

const notes = {
  version: '7.2c',
  title: 'Wild Rift Patch Notes 7.2c',
  champions: [{ slug: 'ahri', name: 'Ahri', changes: ['buff · Q · damage · +10'] }],
  items: ['Infinity Orb — Ability power +15'],
};

describe('fingerprintPatchNotes', () => {
  it('is stable for the same stored notes', () => {
    expect(fingerprintPatchNotes(notes)).toBe(fingerprintPatchNotes(notes));
  });

  it('changes when a patch-note line changes', () => {
    const updated = {
      ...notes,
      champions: [{ slug: 'ahri', name: 'Ahri', changes: ['nerf · Q · damage · -10'] }],
    };
    expect(fingerprintPatchNotes(updated)).not.toBe(fingerprintPatchNotes(notes));
  });

  it('does not depend on live win-rate text', () => {
    const withRates = fingerprintPatchNotes(notes);
    const sameNotes = fingerprintPatchNotes({
      ...notes,
      champions: [{ slug: 'ahri', name: 'Ahri', changes: ['buff · Q · damage · +10'] }],
    });
    expect(sameNotes).toBe(withRates);
  });
});

describe('analysisIsCurrent', () => {
  it('skips OpenAI when the stored hash matches', () => {
    const hash = fingerprintPatchNotes(notes);
    expect(analysisIsCurrent(hash, hash)).toBe(true);
  });

  it('refreshes when there is no stored analysis', () => {
    expect(analysisIsCurrent(undefined, fingerprintPatchNotes(notes))).toBe(false);
  });

  it('refreshes when stored notes changed', () => {
    const previous = fingerprintPatchNotes(notes);
    const next = fingerprintPatchNotes({
      ...notes,
      items: ['Infinity Orb — Ability power +25'],
    });
    expect(analysisIsCurrent(previous, next)).toBe(false);
  });
});
