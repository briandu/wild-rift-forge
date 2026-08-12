import { extractNextData, getBlades, type RiotBlade } from '../extract-next-data';

export interface ChampionDetail {
  name: string;
  /** Flavor title, e.g. "The Darkin Blade". */
  title: string | null;
  /** Role ids, lowercase, e.g. ["fighter"]. */
  roles: string[];
  /** Difficulty label, e.g. "Medium". */
  difficulty: string | null;
  /**
   * Default skin splash from Available Skins (first carousel group).
   * On Riot's champion pages the first entry is always the classic/default look.
   */
  defaultSkinImageUrl: string | null;
}

interface CharacterMastheadBlade {
  type: string;
  title?: string;
  subtitle?: string;
  role?: { roles?: Array<{ id?: string }> };
  difficulty?: { name?: string };
}

interface LandingMediaCarouselBlade {
  type: string;
  header?: { title?: string };
  groups?: Array<{
    label?: string;
    content?: { media?: { url?: string } };
    thumbnail?: { url?: string };
  }>;
}

/** Parse a champion detail page (`/en-us/champions/<slug>/`). */
export function parseChampionDetail(html: string): ChampionDetail {
  const blades = getBlades(extractNextData(html));
  const masthead = blades.find((blade) => blade.type === 'characterMasthead') as
    | CharacterMastheadBlade
    | undefined;
  if (!masthead?.title) {
    throw new Error('No characterMasthead blade found on champion detail page');
  }
  return {
    name: masthead.title,
    title: masthead.subtitle ?? null,
    roles: (masthead.role?.roles ?? [])
      .map((role) => (role.id ?? '').toLowerCase())
      .filter(Boolean),
    difficulty: masthead.difficulty?.name ?? null,
    defaultSkinImageUrl: parseDefaultSkinImageUrl(blades),
  };
}

/** First Available Skins group = default champion art. */
function parseDefaultSkinImageUrl(blades: RiotBlade[]): string | null {
  const carousel = blades.find((blade) => blade.type === 'landingMediaCarousel') as
    | LandingMediaCarouselBlade
    | undefined;
  if (!carousel?.groups?.length) {
    return null;
  }
  // Prefer the skins carousel when present; fall through if the first group has no media.
  const header = carousel.header?.title?.toLowerCase() ?? '';
  if (header && !header.includes('skin')) {
    return null;
  }
  const first = carousel.groups[0];
  return first?.content?.media?.url ?? first?.thumbnail?.url ?? null;
}
