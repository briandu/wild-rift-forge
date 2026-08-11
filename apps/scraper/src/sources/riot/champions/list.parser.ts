import { extractNextData, getBlades } from '../extract-next-data';

export interface ChampionListEntry {
  name: string;
  slug: string;
  /** Absolute URL of the champion detail page. */
  url: string;
  imageUrl: string | null;
}

const BASE_URL = 'https://wildrift.leagueoflegends.com';

interface CharacterCardItem {
  title?: string;
  media?: { url?: string };
  action?: { payload?: { url?: string } };
}

/**
 * Parse the champions listing page (`/en-us/champions/`).
 * The character card grid blade contains the full roster.
 */
export function parseChampionList(html: string): ChampionListEntry[] {
  const blades = getBlades(extractNextData(html));
  const grid = blades.find((blade) => blade.type === 'characterCardGrid');
  if (!grid || !Array.isArray(grid.items)) {
    throw new Error('No characterCardGrid blade found on champions page');
  }
  const entries: ChampionListEntry[] = [];
  for (const item of grid.items as CharacterCardItem[]) {
    const relativeUrl = item.action?.payload?.url;
    if (!item.title || !relativeUrl) {
      continue;
    }
    const slug = relativeUrl.replace(/\/+$/, '').split('/').pop() ?? '';
    if (!slug) {
      continue;
    }
    entries.push({
      name: item.title,
      slug,
      url: relativeUrl.startsWith('http') ? relativeUrl : `${BASE_URL}${relativeUrl}`,
      imageUrl: item.media?.url ?? null,
    });
  }
  return entries;
}
