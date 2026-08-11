import { extractNextData, getBlades } from '../extract-next-data';

export interface PatchIndexEntry {
  title: string;
  /** Absolute URL of the patch notes article. */
  url: string;
  /** ISO publish date when available. */
  publishedAt: string | null;
}

const BASE_URL = 'https://wildrift.leagueoflegends.com';

interface CardGridItem {
  title?: string;
  publishedAt?: string;
  date?: string;
  action?: { payload?: { url?: string } };
}

/**
 * Parse the patch-notes tag page (`/en-us/news/tags/patch-notes/`).
 * The article grid blade contains the complete historical index of patch
 * notes articles, newest first.
 */
export function parsePatchIndex(html: string): PatchIndexEntry[] {
  const blades = getBlades(extractNextData(html));
  const grid = blades.find((blade) => Array.isArray(blade.items));
  if (!grid) {
    throw new Error('No article grid blade found on patch index page');
  }
  const items = grid.items as CardGridItem[];
  const entries: PatchIndexEntry[] = [];
  for (const item of items) {
    const relativeUrl = item.action?.payload?.url;
    if (!item.title || !relativeUrl) {
      continue;
    }
    entries.push({
      title: item.title,
      url: relativeUrl.startsWith('http') ? relativeUrl : `${BASE_URL}${relativeUrl}`,
      publishedAt: item.publishedAt ?? item.date ?? null,
    });
  }
  return entries;
}
