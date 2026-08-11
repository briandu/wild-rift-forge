import { extractNextData, getBlades } from '../extract-next-data';

export interface ChampionDetail {
  name: string;
  /** Flavor title, e.g. "The Darkin Blade". */
  title: string | null;
  /** Role ids, lowercase, e.g. ["fighter"]. */
  roles: string[];
  /** Difficulty label, e.g. "Medium". */
  difficulty: string | null;
}

interface CharacterMastheadBlade {
  type: string;
  title?: string;
  subtitle?: string;
  role?: { roles?: Array<{ id?: string }> };
  difficulty?: { name?: string };
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
  };
}
