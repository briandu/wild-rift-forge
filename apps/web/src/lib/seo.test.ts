import { describe, expect, it } from 'vitest';
import { PRODUCTION_SITE_URL } from './supabase/site-url';
import {
  PAGE_COPY,
  SITE_DESCRIPTION,
  SITE_ICONS,
  SITE_TITLE,
  absoluteUrl,
  championProfileDescription,
  countersDescription,
  countersTitle,
  fullPageTitle,
  matchupDescription,
  matchupTitle,
  nameFromRoster,
  pageMetadata,
  patchDescription,
  patchTitle,
  titleFromSlug,
} from './seo';

describe('absoluteUrl', () => {
  it('uses the production origin for the homepage', () => {
    expect(absoluteUrl('/')).toBe(PRODUCTION_SITE_URL);
    expect(absoluteUrl()).toBe(PRODUCTION_SITE_URL);
  });

  it('joins a path onto www.wildriftforge.com', () => {
    expect(absoluteUrl('/counters/ahri')).toBe(`${PRODUCTION_SITE_URL}/counters/ahri`);
  });
});

describe('titleFromSlug', () => {
  it('title-cases hyphenated slugs', () => {
    expect(titleFromSlug('miss-fortune')).toBe('Miss Fortune');
    expect(titleFromSlug('jarvan-iv')).toBe('Jarvan Iv');
  });
});

describe('nameFromRoster', () => {
  it('prefers the roster name, then the slug', () => {
    expect(nameFromRoster([{ slug: 'ahri', name: 'Ahri' }], 'ahri')).toBe('Ahri');
    expect(nameFromRoster([], 'ahri')).toBe('Ahri');
  });
});

describe('page titles and descriptions', () => {
  it('keeps the homepage description long enough that Google should not pad hero copy', () => {
    expect(SITE_TITLE).toContain('Wild Rift Forge');
    expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it('builds champion, counter, matchup, and patch copy from names', () => {
    expect(fullPageTitle('Ahri counters')).toBe('Ahri counters | Wild Rift Forge');
    expect(championProfileDescription('Ahri', 'the Nine-Tailed Fox')).toContain('Ahri, the Nine-Tailed Fox');
    expect(countersTitle('Ahri')).toBe('Ahri counters');
    expect(countersDescription('Ahri', 'Mid')).toContain('Mid');
    expect(matchupTitle('Garen', 'Darius', 'Top')).toBe('Garen vs Darius (Top)');
    expect(matchupDescription('Garen', 'Darius', 'Top')).toContain('Top');
    expect(patchTitle('6.3')).toBe('Patch 6.3');
    expect(patchDescription('6.3')).toContain('6.3');
    expect(PAGE_COPY.items.title).toBe('Items & runes');
    expect(PAGE_COPY.items.description).toContain('items and runes');
    expect(PAGE_COPY.upgrade.title).toBe('Plans');
  });
});

describe('SITE_ICONS', () => {
  it('leads with a 96x96 PNG and never declares a 16x16 favicon', () => {
    const icons = Array.isArray(SITE_ICONS) ? SITE_ICONS : SITE_ICONS.icon;
    const list = Array.isArray(icons) ? icons : [icons];
    const first = list[0];
    expect(first).toMatchObject({ url: '/icon-96.png', sizes: '96x96', type: 'image/png' });
    expect(list.some((icon) => typeof icon === 'object' && icon.sizes === '16x16')).toBe(false);
    expect(list.some((icon) => typeof icon === 'object' && icon.url === '/favicon.ico')).toBe(false);
  });
});

describe('pageMetadata', () => {
  it('sets a canonical URL and an indexable robots tag', () => {
    const meta = pageMetadata({
      title: 'Champions',
      description: 'Browse the roster.',
      path: '/champions',
    });
    expect(meta.alternates).toEqual({ canonical: `${PRODUCTION_SITE_URL}/champions` });
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.openGraph?.title).toBe('Champions | Wild Rift Forge');
  });

  it('keeps an absolute homepage title and can noindex private pages', () => {
    const home = pageMetadata({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      path: '/',
      absoluteTitle: true,
    });
    expect(home.title).toEqual({ absolute: SITE_TITLE });
    expect(home.openGraph?.title).toBe(SITE_TITLE);

    const privatePage = pageMetadata({
      title: 'Account',
      description: 'Your account.',
      path: '/me',
      index: false,
    });
    expect(privatePage.robots).toEqual({ index: false, follow: false });
  });
});
