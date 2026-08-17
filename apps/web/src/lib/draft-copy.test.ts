import { describe, expect, it } from 'vitest';
import { draftPhase } from './draft-copy';

describe('draftPhase', () => {
  it('gates Free accounts on the Pro landing', () => {
    expect(draftPhase('Free', false)).toBe('gated');
    expect(draftPhase('Free', true)).toBe('gated');
  });

  it('resumes a non-empty local board even on Free', () => {
    expect(draftPhase('Free', false, true)).toBe('live');
  });

  it('sends Pro and Squad to ready, then the live board once started', () => {
    expect(draftPhase('Pro', false)).toBe('ready');
    expect(draftPhase('Pro', true)).toBe('live');
    expect(draftPhase('Squad', false)).toBe('ready');
    expect(draftPhase('Squad', true)).toBe('live');
  });
});
