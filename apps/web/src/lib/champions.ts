import type { ApiChampion } from './api-types';

/** Local visual fallbacks when the DB roster is empty. */
export const FALLBACK_CHAMPIONS: ApiChampion[] = [
  {
    slug: 'sett',
    name: 'Sett',
    title: 'The Boss',
    roles: ['fighter'],
    difficulty: 'Medium',
    imageUrl: '/more_art-1786470895713-hupj.avif',
  },
  {
    slug: 'ashe',
    name: 'Ashe',
    title: 'The Frost Archer',
    roles: ['marksman'],
    difficulty: 'Low',
    imageUrl: '/more_art-1786470895700-w5u0.avif',
  },
  {
    slug: 'volibear',
    name: 'Volibear',
    title: 'The Relentless Storm',
    roles: ['fighter'],
    difficulty: 'Medium',
    imageUrl: '/more_art-1786470895704-yijl.avif',
  },
  {
    slug: 'gwen',
    name: 'Gwen',
    title: 'The Hallowed Seamstress',
    roles: ['fighter'],
    difficulty: 'High',
    imageUrl: '/more_art-1786470895708-zrx7.avif',
  },
  {
    slug: 'renekton',
    name: 'Renekton',
    title: 'The Butcher of the Sands',
    roles: ['fighter'],
    difficulty: 'Medium',
    imageUrl: '/more_art-1786470895717-2xza.avif',
  },
];

export const HERO_FALLBACK = '/hero-fallback.avif';

export const FACE_FALLBACK_BG = 'linear-gradient(150deg, #6e6a8c, #3e3a54)';

export const ART_BY_SLUG: Record<string, string> = {
  sett: '/more_art-1786470895713-hupj.avif',
  ashe: '/more_art-1786470895700-w5u0.avif',
  volibear: '/more_art-1786470895704-yijl.avif',
  gwen: '/more_art-1786470895708-zrx7.avif',
  renekton: '/more_art-1786470895717-2xza.avif',
};

export function withRoster(champions: ApiChampion[]): ApiChampion[] {
  return champions.length > 0 ? champions : FALLBACK_CHAMPIONS;
}

export function roleLabel(roles: string[]): string {
  if (roles.length === 0) return 'Champion';
  return roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' · ');
}

export function initials(name: string): string {
  return name.slice(0, 1).toUpperCase();
}

export function artFor(slug: string, imageUrl?: string | null): string {
  return imageUrl || ART_BY_SLUG[slug.toLowerCase()] || HERO_FALLBACK;
}

/** Splash for poster tiles. No shared hero fallback — missing art uses initials. */
export function splashFor(slug: string, imageUrl?: string | null): string | undefined {
  return imageUrl || ART_BY_SLUG[slug.toLowerCase()] || undefined;
}

/** Portrait URL when we have one; otherwise the caller should show initials. */
export function portraitFor(
  slug: string,
  imageUrl?: string | null,
  thumbnailUrl?: string | null,
): string | undefined {
  return thumbnailUrl || imageUrl || ART_BY_SLUG[slug.toLowerCase()] || undefined;
}

export function portraitsFromRoster(champions: ApiChampion[]): Record<string, string> {
  const map = { ...ART_BY_SLUG };
  for (const champion of champions) {
    const portrait = champion.thumbnailUrl || champion.imageUrl;
    if (portrait) {
      map[champion.slug] = portrait;
    }
  }
  return map;
}
