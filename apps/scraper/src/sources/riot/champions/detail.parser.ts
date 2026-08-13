import * as cheerio from 'cheerio';
import type { AbilitySlot, ChampionAbility } from '@wild-rift-forge/game-data';
import { extractNextData, getBlades, type RiotBlade } from '../extract-next-data';
import { highQualitySanityUrl } from '../image-url';

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
  /** Ability kit from the ABILITIES iconTab blade. */
  abilities: ChampionAbility[];
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

interface IconTabBlade {
  type: string;
  header?: { title?: string };
  groups?: Array<{
    label?: string;
    thumbnail?: { url?: string };
    content?: {
      title?: string;
      subtitle?: string;
      description?: { type?: string; body?: string };
      media?: {
        type?: string;
        sources?: Array<{ src?: string; type?: string }>;
      };
    };
  }>;
}

const SLOT_BY_SUBTITLE: Record<string, AbilitySlot> = {
  PASSIVE: 'passive',
  '1': '1',
  '2': '2',
  '3': '3',
  ULTIMATE: 'ultimate',
};

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
    abilities: parseAbilities(blades),
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
  return highQualitySanityUrl(first?.content?.media?.url ?? first?.thumbnail?.url ?? null);
}

/** ABILITIES iconTab → canonical ChampionAbility rows. */
function parseAbilities(blades: RiotBlade[]): ChampionAbility[] {
  const iconTab = blades.find((blade) => {
    if (blade.type !== 'iconTab') {
      return false;
    }
    const header = (blade as IconTabBlade).header?.title?.toUpperCase() ?? '';
    return header.includes('ABILIT');
  }) as IconTabBlade | undefined;

  if (!iconTab?.groups?.length) {
    return [];
  }

  const abilities: ChampionAbility[] = [];
  iconTab.groups.forEach((group, index) => {
    const rawName = group.content?.title?.trim();
    if (!rawName) {
      return;
    }
    const subtitle = (group.content?.subtitle ?? '').trim().toUpperCase();
    const slot = SLOT_BY_SUBTITLE[subtitle] ?? slotFromIndex(index);
    const descriptionHtml = group.content?.description?.body ?? null;
    abilities.push({
      slot,
      name: toDisplayName(rawName),
      description: descriptionHtml ? htmlToText(descriptionHtml) : null,
      iconUrl: highQualitySanityUrl(group.thumbnail?.url ?? null),
      videoUrl: firstVideoUrl(group.content?.media?.sources),
      sortOrder: index,
    });
  });
  return abilities;
}

function slotFromIndex(index: number): AbilitySlot {
  const fallback: AbilitySlot[] = ['passive', '1', '2', '3', 'ultimate'];
  return fallback[index] ?? '1';
}

function firstVideoUrl(
  sources: Array<{ src?: string; type?: string }> | undefined,
): string | null {
  if (!sources?.length) {
    return null;
  }
  const mp4 = sources.find((source) => source.type === 'video/mp4' && source.src);
  return mp4?.src ?? sources.find((source) => source.src)?.src ?? null;
}

/** "DEATHBRINGER STANCE" -> "Deathbringer Stance". */
function toDisplayName(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|[\s'‘’-])([a-z])/g, (_, boundary: string, letter: string) => boundary + letter.toUpperCase());
}

function htmlToText(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, ' ').trim();
}
