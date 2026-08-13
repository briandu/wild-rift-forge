import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  matchRosterSlug,
  parseWildRiftFireHome,
} from '../src/sources/wildriftfire/home.parser';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

function fixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('parseWildRiftFireHome', () => {
  it('parses square face crops from champion tiles', () => {
    const tiles = parseWildRiftFireHome(fixture('wildriftfire-home.html'));
    expect(tiles.length).toBeGreaterThan(100);
    const aatrox = tiles.find((tile) => tile.slug === 'aatrox');
    expect(aatrox).toBeDefined();
    expect(aatrox!.name).toBe('Aatrox');
    expect(aatrox!.imageUrl).toBe('https://www.mobafire.com/images/champion/square/aatrox.png');
  });

  it('resolves relative icon paths to wildriftfire.com', () => {
    const tiles = parseWildRiftFireHome(fixture('wildriftfire-home.html'));
    const ambessa = tiles.find((tile) => tile.slug === 'ambessa');
    expect(ambessa!.imageUrl).toBe('https://www.wildriftfire.com/images/champion/icon/ambessa.png');
  });

  it('matches WRF nunu slug to the roster slug', () => {
    expect(matchRosterSlug('nunu-&-willump', ['nunu-and-willump', 'aatrox'])).toBe(
      'nunu-and-willump',
    );
    expect(matchRosterSlug('nunu-amp-willump', ['nunu-and-willump'])).toBe('nunu-and-willump');
    expect(matchRosterSlug('aatrox', ['aatrox'])).toBe('aatrox');
  });
});
