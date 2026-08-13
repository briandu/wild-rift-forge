import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.wildriftfire.com';

export interface WildRiftFireThumbnail {
  /** Tile `url`/`id` attribute, e.g. "aatrox" or "nunu-&-willump". */
  slug: string;
  name: string;
  /** Absolute URL of the square face crop inside the tile. */
  imageUrl: string;
}

/**
 * Parse champion tiles from the WildRiftFire homepage grid.
 * Each tile's face image is a zoomed-in square portrait (Mobafire CDN or
 * a local /images/champion/icon/ asset for newer champs).
 */
export function parseWildRiftFireHome(html: string): WildRiftFireThumbnail[] {
  const $ = cheerio.load(html);
  const tiles: WildRiftFireThumbnail[] = [];
  $('.wf-home__champions__champion').each((_, element) => {
    const slug = ($(element).attr('url') ?? $(element).attr('id') ?? '').trim();
    const name = $(element).find('.wf-home__champions__champion__name').first().text().trim();
    const src = $(element).find('.wf-home__champions__champion__face img').attr('src')?.trim();
    if (!slug || !src) {
      return;
    }
    tiles.push({
      slug,
      name,
      imageUrl: src.startsWith('http') ? src : new URL(src, BASE_URL).href,
    });
  });
  return tiles;
}

/** Collapse punctuation so "nunu-&-willump" / "nunu-amp-willump" match "nunu-and-willump". */
export function normalizeChampionKey(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/-amp-/g, '-and-')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

export function matchRosterSlug(wrfSlug: string, rosterSlugs: string[]): string | null {
  const key = normalizeChampionKey(wrfSlug);
  const byKey = new Map(rosterSlugs.map((slug) => [normalizeChampionKey(slug), slug]));
  return byKey.get(key) ?? null;
}
