import type { AbilityDto } from './api';

export interface AbilityInfo {
  key: string;
  name: string;
  description: string;
  imageUrl?: string;
}

const GWEN: AbilityInfo[] = [
  {
    key: 'P',
    name: 'Thousand Cuts',
    imageUrl: '/abilities/gwen-passive.avif',
    description:
      "Deals bonus magic damage based on the target's maximum health and heals her for part of it.",
  },
  {
    key: 'Q',
    name: 'Snip Snip!',
    imageUrl: '/abilities/gwen-q.avif',
    description: 'Six snips in a cone. The last one hits harder and reaches further.',
  },
  {
    key: 'W',
    name: 'Hallowed Mist',
    imageUrl: '/abilities/gwen-w.avif',
    description:
      'Summons a mist that blocks damage from enemies outside it, and follows her once.',
  },
  {
    key: 'E',
    name: "Skip 'n Slash",
    imageUrl: '/abilities/gwen-e.avif',
    description: 'Dashes and empowers her next attack with extra range and attack speed.',
  },
  {
    key: 'R',
    name: 'Needlework',
    imageUrl: '/abilities/gwen-r.avif',
    description:
      'Throws needles that slow and damage. Recasts up to three times, each volley larger.',
  },
];

const BLANK: AbilityInfo[] = [
  {
    key: 'P',
    name: 'Passive',
    description: 'Ability art not uploaded yet. Kit details fill in when icons land.',
  },
  { key: 'Q', name: 'First ability', description: 'Ability art not uploaded yet.' },
  { key: 'W', name: 'Second ability', description: 'Ability art not uploaded yet.' },
  { key: 'E', name: 'Third ability', description: 'Ability art not uploaded yet.' },
  { key: 'R', name: 'Ultimate', description: 'Ability art not uploaded yet.' },
];

const BY_SLUG: Record<string, AbilityInfo[]> = {
  gwen: GWEN,
};

export function abilitiesFor(slug: string): AbilityInfo[] {
  return BY_SLUG[slug.toLowerCase()] ?? BLANK;
}

/** Prefer scraped kit from the API; fall back to local Gwen art or blanks. */
export function resolveAbilities(slug: string, fromApi?: AbilityDto[] | null): AbilityInfo[] {
  if (fromApi?.length) {
    return fromApi.map((ability) => ({
      key: ability.key,
      name: ability.name,
      description: ability.description,
      imageUrl: ability.imageUrl,
    }));
  }
  return abilitiesFor(slug);
}
