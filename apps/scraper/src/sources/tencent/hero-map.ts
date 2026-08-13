import { normalizeChampionKey } from '../wildriftfire/home.parser';

const HERO_SLUG_ALIASES: Record<string, string> = {
  monkeyking: 'wukong',
  nunu: 'nunu-and-willump',
};

function compact(value: string): string {
  return normalizeChampionKey(value);
}

/**
 * Match a Tencent/Riot PascalCase id (Garen, MissFortune, MonkeyKing) to a roster slug.
 */
export function matchHeroToRoster(heroName: string, rosterSlugs: string[]): string | null {
  const key = compact(heroName);
  if (!key) {
    return null;
  }
  const aliased = HERO_SLUG_ALIASES[key];
  const byKey = new Map(rosterSlugs.map((slug) => [compact(slug), slug]));
  if (aliased && byKey.has(compact(aliased))) {
    return byKey.get(compact(aliased)) ?? null;
  }
  const exact = byKey.get(key);
  if (exact) {
    return exact;
  }
  const prefixHits = rosterSlugs.filter((slug) => compact(slug).startsWith(key) && key.length >= 4);
  if (prefixHits.length === 1) {
    return prefixHits[0]!;
  }
  return null;
}
