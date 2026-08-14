import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { wrfChampionSchema } from '@wild-rift-forge/game-data';
import { parseIndexFromFooter, parseIndexFromHome } from '../src/sources/wildriftfire/champion-index';
import { extractChampionPage, normalizeChampionPage } from '../src/sources/wildriftfire/champion-page';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

function fixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('WildRiftFire champion page', () => {
  it('extracts Garen stats, patch, and Q numbers from the about block', () => {
    const raw = extractChampionPage(fixture('wrf-garen-about.html'), 'https://www.wildriftfire.com/guide/garen');
    expect(raw.name).toBe('Garen');
    expect(raw.title).toBe('The Might of Demacia');
    expect(raw.observedPatch).toBe('7.2c');
    expect(raw.positions).toContain('solo');
    expect(raw.resourceHint).toBe('none');
    expect(raw.stats.find((row) => row.label === 'Health')).toEqual({
      label: 'Health',
      base: 660,
      perLevel: 128,
    });
    const q = raw.abilities.find((ability) => ability.slot === 'q');
    expect(q?.name).toBe('Decisive Strike');
    expect(q?.cooldown).toEqual([9, 8, 8, 7]);
    expect(q?.costValues).toBeNull();

    const champion = normalizeChampionPage(
      raw,
      '2026-08-14T17:00:00.000Z',
      'https://www.wildriftfire.com/guide/garen',
    );
    expect(wrfChampionSchema.parse(champion).id).toBe('garen');
    expect(champion.stats.health).toBe(660);
    expect(champion.stats.healthPerLevel).toBe(128);
    expect(champion.stats.resource.type).toBe('none');
    expect(champion.abilities.q.cooldown).toEqual([9, 8, 8, 7]);
    expect(champion.abilities.q.effects.some((effect) => effect.type === 'damage')).toBe(true);
    expect(champion.abilities.q.effects.some((effect) => effect.type === 'silence')).toBe(true);
    expect(champion.source.provider).toBe('WildRiftFire');
    expect(champion.source.observedPatch).toBe('7.2c');
  });

  it('reads Ahri mana and ability cost without inventing missing range', () => {
    const raw = extractChampionPage(fixture('wrf-ahri-about.html'), 'https://www.wildriftfire.com/guide/ahri');
    expect(raw.resourceHint).toBe('mana');
    const q = raw.abilities.find((ability) => ability.slot === 'q');
    expect(q?.costValues).toEqual([65, 70, 75, 80]);
    const champion = normalizeChampionPage(raw, '2026-08-14T17:00:00.000Z', 'https://www.wildriftfire.com/guide/ahri');
    expect(champion.stats.resource).toEqual({
      type: 'mana',
      maximum: 435,
      maximumPerLevel: 37,
      regen5: 18,
      regen5PerLevel: 1,
    });
    expect(champion.abilities.q.cost).toEqual({ type: 'mana', values: [65, 70, 75, 80] });
    expect(champion.stats.attackRange).toBeNull();
  });
});

describe('champion index', () => {
  it('reads homepage tiles and footer guide links', () => {
    const home = parseIndexFromHome(fixture('wildriftfire-home.html'));
    expect(home.find((entry) => entry.id === 'aatrox')?.url).toBe('https://www.wildriftfire.com/guide/aatrox');
    const footer = parseIndexFromFooter(`
      <div id="foot-list"><div class="footer-links">
        <a href="/guide/chogath">Cho'Gath</a>
        <a href="/guide/nunu-amp-willump">Nunu &amp; Willump</a>
      </div></div>`);
    expect(footer.map((entry) => entry.id)).toEqual(['chogath', 'nunu-amp-willump']);
  });
});
