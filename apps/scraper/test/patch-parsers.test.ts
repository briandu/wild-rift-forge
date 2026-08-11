import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePatchIndex } from '../src/sources/riot/patch-notes/index.parser';
import { parsePatchArticle } from '../src/sources/riot/patch-notes/article.parser';
import { extractPatchVersion } from '../src/sources/riot/patch-notes/version';
import { validateParsedPatch } from '../src/validators/patch.validator';
import { normalizePatch, parseChangeBullet, parseValue, toTitleCase } from '../src/normalizers/patch.normalizer';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

function fixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('extractPatchVersion', () => {
  it('extracts simple and lettered versions', () => {
    expect(extractPatchVersion('Wild Rift Patch Notes 7.2b')).toBe('7.2b');
    expect(extractPatchVersion('Wild Rift Patch Notes 2.6a')).toBe('2.6a');
    expect(extractPatchVersion('Wild Rift Patch Notes 5.0')).toBe('5.0');
  });

  it('returns null when no version is present', () => {
    expect(extractPatchVersion('Wild Rift Closed Beta Patch Notes')).toBeNull();
  });
});

describe('parsePatchIndex', () => {
  it('parses the full historical index', () => {
    const entries = parsePatchIndex(fixture('patch-notes-index.html'));
    expect(entries.length).toBeGreaterThan(100);
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\//);
      expect(entry.title.length).toBeGreaterThan(0);
    }
    const first = entries[0]!;
    expect(extractPatchVersion(first.title)).toBeTruthy();
    expect(first.publishedAt).toBeTruthy();
  });
});

describe('parsePatchArticle + normalizePatch', () => {
  it('extracts the Jayce base armor nerf from patch 7.2b', () => {
    const parsed = validateParsedPatch(
      parsePatchArticle(fixture('patch-7-2b.html'), 'https://example.com/7-2b'),
    );
    expect(parsed.title).toBe('Wild Rift Patch Notes 7.2b');
    expect(parsed.characterChanges.length).toBeGreaterThan(0);

    const { patch, changes } = normalizePatch(parsed, '7.2b');
    expect(patch.version).toBe('7.2b');
    expect(patch.releaseDate).toBeTruthy();

    const jayce = changes.find(
      (change) => change.entityName === 'Jayce' && change.property === 'Base Armor',
    );
    expect(jayce).toBeDefined();
    expect(jayce!.entityType).toBe('champion');
    expect(jayce!.ability).toBe('Base Stats');
    expect(jayce!.oldValue).toBe(46);
    expect(jayce!.newValue).toBe(37);
    expect(jayce!.metadata?.summary).toContain('Jayce');
  });

  it('parses the 5.0-era layout (patchNotesRichText + accordion)', () => {
    const parsed = validateParsedPatch(
      parsePatchArticle(fixture('patch-5-0.html'), 'https://example.com/5-0'),
    );
    const { changes } = normalizePatch(parsed, '5.0');
    const championChanges = changes.filter((change) => change.entityType === 'champion');
    const systemChanges = changes.filter((change) => change.entityType === 'system');
    expect(championChanges.length).toBeGreaterThan(0);
    expect(systemChanges.length).toBeGreaterThan(0);
  });

  it('parses the 2.6a-era layout', () => {
    const parsed = validateParsedPatch(
      parsePatchArticle(fixture('patch-2-6a.html'), 'https://example.com/2-6a'),
    );
    expect(parsed.characterChanges.length).toBeGreaterThanOrEqual(10);
    const { changes } = normalizePatch(parsed, '2.6a');
    expect(changes.length).toBeGreaterThan(10);
  });
});

describe('parseChangeBullet', () => {
  it('parses property with old and new values', () => {
    expect(parseChangeBullet('Base Armor: 46 → 37')).toEqual({
      property: 'Base Armor',
      oldValue: 46,
      newValue: 37,
    });
  });

  it('parses value-only arrows', () => {
    expect(parseChangeBullet('200 → 225')).toEqual({
      property: null,
      oldValue: 200,
      newValue: 225,
    });
  });

  it('parses scaling values into arrays', () => {
    expect(parseChangeBullet('Base Damage: 50/80/110 → 60/90/120')).toEqual({
      property: 'Base Damage',
      oldValue: [50, 80, 110],
      newValue: [60, 90, 120],
    });
  });

  it('keeps unparseable bullets as description-only', () => {
    expect(parseChangeBullet('Now grants bonus movement speed while in a bush')).toEqual({
      property: null,
      oldValue: null,
      newValue: null,
    });
  });
});

describe('parseValue', () => {
  it('parses numbers, slash-arrays, and falls back to strings', () => {
    expect(parseValue('46')).toBe(46);
    expect(parseValue('50/80/110')).toEqual([50, 80, 110]);
    expect(parseValue('8%')).toBe('8%');
  });
});

describe('toTitleCase', () => {
  it('handles multi-word and apostrophe names', () => {
    expect(toTitleCase('XIN ZHAO')).toBe('Xin Zhao');
    expect(toTitleCase("KAI'SA")).toBe("Kai'Sa");
    expect(toTitleCase('JAYCE')).toBe('Jayce');
  });
});
