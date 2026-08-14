import type { AbilityDto } from './api';

export interface AbilityInfo {
  key: string;
  name: string;
  description: string;
  imageUrl?: string;
}

/** Scraped kit only. Empty when the API has not ingested abilities yet. */
export function resolveAbilities(fromApi?: AbilityDto[] | null): AbilityInfo[] {
  if (!fromApi?.length) return [];
  return fromApi.map((ability) => ({
    key: ability.key,
    name: ability.name,
    description: ability.description,
    imageUrl: ability.imageUrl,
  }));
}
