import type { Metadata } from 'next';
import { PRODUCTION_SITE_URL } from './supabase/site-url';

export const SITE_NAME = 'Wild Rift Forge';
export const SITE_TITLE = 'Wild Rift Forge — Counters, Matchups & Draft';
export const SITE_DESCRIPTION =
  'Find the right Wild Rift counter. Search any champion for counters, matchup notes, tier lists, and draft help — updated with the current patch.';

export const PAGE_COPY = {
  champions: {
    title: 'Champions',
    description:
      'Browse the Wild Rift champion roster. Open a profile for abilities, counters, and current-patch notes.',
  },
  matchups: {
    title: 'Matchups',
    description:
      'Wild Rift matchup guides: who wins the lane, what to play around, and how to close.',
  },
  draft: {
    title: 'Draft',
    description: 'Build a Wild Rift draft. See who counters the enemy team and who fits your side.',
  },
  items: {
    title: 'Items & runes',
    description:
      'Wild Rift items and runes — catalog art, stats, and passives from the current design handoff.',
  },
  upgrade: {
    title: 'Plans',
    description: 'Wild Rift Forge Free, Pro, and Squad — climb with your own data.',
  },
  tier: {
    title: 'Tier list',
    description:
      'Wild Rift tier list by lane, based on Diamond+ ranked stats for the current patch.',
  },
  patch: {
    title: 'Patch notes',
    description:
      'Latest Wild Rift patch notes — champion changes, what shifted, and who it matters for.',
  },
  login: {
    title: 'Sign in',
    description: 'Sign in to Wild Rift Forge to save your pool and follow the current patch.',
  },
  account: {
    title: 'Account',
    description: 'Your Wild Rift Forge account, champion pool, and linked Riot ID.',
  },
} as const;

export function absoluteUrl(path = '/'): string {
  if (!path || path === '/') return PRODUCTION_SITE_URL;
  return `${PRODUCTION_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function nameFromRoster(
  champions: ReadonlyArray<{ slug: string; name: string }>,
  slug: string,
): string {
  return champions.find((row) => row.slug === slug)?.name ?? titleFromSlug(slug);
}

export function fullPageTitle(page: string): string {
  return page.includes(SITE_NAME) ? page : `${page} | ${SITE_NAME}`;
}

export function championProfileTitle(name: string): string {
  return name;
}

export function championProfileDescription(name: string, title?: string | null): string {
  const who = title ? `${name}, ${title}` : name;
  return `${who} in Wild Rift — abilities, counters, and current-patch notes.`;
}

export function countersTitle(name: string): string {
  return `${name} counters`;
}

export function countersDescription(name: string, lane?: string | null): string {
  if (lane) {
    return `Best ${name} counters in Wild Rift ${lane}. See who beats them in lane and why those picks work.`;
  }
  return `Best ${name} counters in Wild Rift. See who beats them in lane and why those picks work.`;
}

export function matchupTitle(you: string, them: string, lane: string): string {
  return `${you} vs ${them} (${lane})`;
}

export function matchupDescription(you: string, them: string, lane: string): string {
  return `${you} vs ${them} in ${lane} — how to play the matchup in Wild Rift.`;
}

export function patchTitle(version?: string | null): string {
  return version ? `Patch ${version}` : PAGE_COPY.patch.title;
}

export function patchDescription(version?: string | null): string {
  if (!version) return PAGE_COPY.patch.description;
  return `Wild Rift patch ${version} notes — champion changes, what shifted, and who it matters for.`;
}

export function pageMetadata({
  title,
  description,
  path,
  index = true,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  absoluteTitle?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const ogTitle = absoluteTitle ? title : fullPageTitle(title);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: ogTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary',
      title: ogTitle,
      description,
    },
  };
}
