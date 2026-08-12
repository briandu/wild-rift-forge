import type { ApiChampion } from './api';

/** Local visual fallbacks when the DB roster is empty. */
export const FALLBACK_CHAMPIONS: ApiChampion[] = [
  {
    slug: 'sett',
    name: 'Sett',
    title: 'The Boss',
    roles: ['fighter'],
    difficulty: 'Medium',
    imageUrl: '/more_art-1786470895700-w5u0.avif',
  },
  {
    slug: 'ashe',
    name: 'Ashe',
    title: 'The Frost Archer',
    roles: ['marksman'],
    difficulty: 'Low',
    imageUrl: '/more_art-1786470895704-yijl.avif',
  },
  {
    slug: 'volibear',
    name: 'Volibear',
    title: 'The Relentless Storm',
    roles: ['fighter'],
    difficulty: 'Medium',
    imageUrl: '/more_art-1786470895708-zrx7.avif',
  },
  {
    slug: 'gwen',
    name: 'Gwen',
    title: 'The Hallowed Seamstress',
    roles: ['fighter'],
    difficulty: 'High',
    imageUrl: '/more_art-1786470895713-hupj.avif',
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
