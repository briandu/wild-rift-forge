import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTencentHeroList } from '../src/sources/tencent/hero-list.parser';
import { matchHeroToRoster } from '../src/sources/tencent/hero-map';
import { parseRy2xHeroStats, parseTencentHeroRank } from '../src/sources/tencent/stats.parser';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

function fixtureJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8')) as unknown;
}

describe('parseTencentHeroList', () => {
  it('maps hero_id to English names from poster filenames', () => {
    const map = parseTencentHeroList(fixtureJson('tencent-hero-list.json'));
    expect(map.get('10001')).toBe('Garen');
    expect(map.get('10008')).toBe('Nunu');
    expect(map.get('10009')).toBe('MonkeyKing');
    expect(map.get('10038')).toBe('Ahri');
    expect(map.get('10066')).toBe('MissFortune');
  });
});

describe('parseTencentHeroRank', () => {
  it('flattens Diamond+ rows onto Forge lanes', () => {
    const rows = parseTencentHeroRank(fixtureJson('tencent-hero-rank.json'));
    expect(rows).toHaveLength(3);
    const ahri = rows.find((row) => row.heroId === '10038');
    expect(ahri).toMatchObject({
      lane: 'Mid',
      rankBracket: 'diamond_plus',
      winRate: 52.3,
      pickRate: 6.8,
      banRate: 0.22,
      snapshotDate: '2026-08-11',
    });
    expect(rows.find((row) => row.heroId === '10001')?.lane).toBe('Top');
    expect(rows.find((row) => row.heroId === '10066')?.lane).toBe('Dragon');
  });
});

describe('parseRy2xHeroStats', () => {
  it('reads the merged JSON fallback shape', () => {
    const rows = parseRy2xHeroStats({
      date: '2026-08-11T00:00:00.000Z',
      data: {
        diamond_plus: {
          mid: [
            {
              id: 'Ahri',
              hero_id: '10038',
              win_rate_percent: '52.30%',
              appear_rate_percent: '6.80%',
              forbid_rate_percent: '0.22%',
              strength: 8,
              strength_level: 2,
            },
          ],
        },
      },
    });
    expect(rows[0]).toMatchObject({
      heroId: '10038',
      lane: 'Mid',
      rankBracket: 'diamond_plus',
      winRate: 52.3,
      snapshotDate: '2026-08-11',
    });
  });
});

describe('matchHeroToRoster', () => {
  const roster = ['garen', 'ahri', 'miss-fortune', 'wukong', 'nunu-and-willump', 'kog-maw'];

  it('matches PascalCase ids to kebab slugs', () => {
    expect(matchHeroToRoster('Garen', roster)).toBe('garen');
    expect(matchHeroToRoster('MissFortune', roster)).toBe('miss-fortune');
    expect(matchHeroToRoster('Kogmaw', roster)).toBe('kog-maw');
  });

  it('applies known aliases', () => {
    expect(matchHeroToRoster('MonkeyKing', roster)).toBe('wukong');
    expect(matchHeroToRoster('Nunu', roster)).toBe('nunu-and-willump');
  });
});
