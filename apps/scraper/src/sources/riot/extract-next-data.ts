import * as cheerio from 'cheerio';

/**
 * Riot's Wild Rift site is a Next.js app. Every page embeds its full data
 * payload as JSON in a `#__NEXT_DATA__` script tag, and page content is
 * composed of typed "blades" (CMS components). Parsing this JSON is far more
 * stable than scraping rendered HTML.
 *
 * Everything in this directory understands Riot-specific structures.
 * Nothing outside `sources/riot/` should.
 */

export interface RiotBlade {
  type: string;
  [key: string]: unknown;
}

export function extractNextData(html: string): unknown {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').text();
  if (!raw) {
    throw new Error('No __NEXT_DATA__ script tag found — page structure may have changed');
  }
  return JSON.parse(raw);
}

export function getBlades(nextData: unknown): RiotBlade[] {
  const blades = (nextData as { props?: { pageProps?: { page?: { blades?: unknown } } } })?.props
    ?.pageProps?.page?.blades;
  if (!Array.isArray(blades)) {
    throw new Error('No blades array in __NEXT_DATA__ — page structure may have changed');
  }
  return blades as RiotBlade[];
}
