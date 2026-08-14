import * as cheerio from 'cheerio';
import type { WrfIndexEntry } from '@wild-rift-forge/game-data';

const BASE_URL = 'https://www.wildriftfire.com';

function decodeId(href: string): string | null {
  const match = href.match(/\/guide\/([^/?#]+)/i);
  if (!match?.[1] || match[1] === '') {
    return null;
  }
  return decodeURIComponent(match[1]).trim();
}

function toEntry(id: string, name: string): WrfIndexEntry {
  return {
    id,
    name: name.replace(/\s+/g, ' ').trim() || id,
    url: `${BASE_URL}/guide/${id}`,
  };
}

/** Champion tiles on the homepage grid. */
export function parseIndexFromHome(html: string): WrfIndexEntry[] {
  const $ = cheerio.load(html);
  const entries: WrfIndexEntry[] = [];
  $('.wf-home__champions__champion').each((_, element) => {
    const href = $(element).find('a[href*="/guide/"]').first().attr('href') ?? '';
    const id = decodeId(href) ?? ($(element).attr('url') ?? $(element).attr('id') ?? '').trim();
    const name = $(element).find('.wf-home__champions__champion__name').first().text().trim();
    if (!id) {
      return;
    }
    entries.push(toEntry(id, name));
  });
  return entries;
}

/** Footer champion list present on most WRF pages, including the /guide 404. */
export function parseIndexFromFooter(html: string): WrfIndexEntry[] {
  const $ = cheerio.load(html);
  const entries: WrfIndexEntry[] = [];
  $('#foot-list a[href*="/guide/"], .footer-links a[href*="/guide/"]').each((_, element) => {
    const href = $(element).attr('href') ?? '';
    const id = decodeId(href);
    if (!id) {
      return;
    }
    entries.push(toEntry(id, $(element).text()));
  });
  return entries;
}

export function mergeChampionIndex(...lists: WrfIndexEntry[][]): WrfIndexEntry[] {
  const byId = new Map<string, WrfIndexEntry>();
  for (const list of lists) {
    for (const entry of list) {
      const current = byId.get(entry.id);
      if (!current || (entry.name && entry.name !== entry.id && current.name === current.id)) {
        byId.set(entry.id, entry);
      }
    }
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}
