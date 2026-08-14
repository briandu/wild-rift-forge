import { describe, expect, it } from 'vitest';
import { resolveAbilities } from './abilities';

describe('resolveAbilities', () => {
  it('uses scraped kit text and does not invent a blank kit', () => {
    expect(resolveAbilities(null)).toEqual([]);
    expect(resolveAbilities([])).toEqual([]);
    expect(
      resolveAbilities([{ key: 'Q', name: 'Snip Snip!', description: 'Six snips.' }]),
    ).toEqual([{ key: 'Q', name: 'Snip Snip!', description: 'Six snips.', imageUrl: undefined }]);
  });
});
