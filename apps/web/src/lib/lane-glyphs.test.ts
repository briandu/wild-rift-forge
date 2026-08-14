import { describe, expect, it } from 'vitest';
import { LANE_GLYPH_PATHS, laneGlyphPath } from './lane-glyphs';

describe('laneGlyphPath', () => {
  it('has the six 3A marks and skips unknown lanes', () => {
    expect(Object.keys(LANE_GLYPH_PATHS)).toEqual(['All', 'Top', 'Jungle', 'Mid', 'Dragon', 'Support']);
    expect(laneGlyphPath('Top')?.startsWith('M34.4')).toBe(true);
    expect(laneGlyphPath('Baron')).toBeUndefined();
  });
});
