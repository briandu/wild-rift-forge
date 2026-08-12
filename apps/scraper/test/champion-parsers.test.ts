import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseChampionList } from '../src/sources/riot/champions/list.parser';
import { parseChampionDetail } from '../src/sources/riot/champions/detail.parser';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

function fixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('parseChampionList', () => {
  it('parses the full roster from the champions page', () => {
    const roster = parseChampionList(fixture('champions-list.html'));
    expect(roster.length).toBeGreaterThan(100);
    const aatrox = roster.find((champion) => champion.slug === 'aatrox');
    expect(aatrox).toBeDefined();
    expect(aatrox!.name).toBe('AATROX');
    expect(aatrox!.url).toBe('https://wildrift.leagueoflegends.com/en-us/champions/aatrox/');
    expect(aatrox!.imageUrl).toMatch(/^https:\/\//);
  });
});

describe('parseChampionDetail', () => {
  it('parses masthead data from a champion detail page', () => {
    const detail = parseChampionDetail(fixture('champion-aatrox.html'));
    expect(detail.name).toBe('AATROX');
    expect(detail.title).toBe('The Darkin Blade');
    expect(detail.roles).toEqual(['fighter']);
    expect(detail.difficulty).toBe('Medium');
  });

  it('uses the first Available Skins image as the default skin splash', () => {
    const detail = parseChampionDetail(fixture('champion-aatrox.html'));
    expect(detail.defaultSkinImageUrl).toMatch(
      /^https:\/\/cmsassets\.rgpub\.io\/sanity\/images\/.+\.jpg/,
    );
  });
});
