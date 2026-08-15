import type { AbilityDto } from './api';

export interface AbilityInfo {
  key: string;
  name: string;
  description: string;
  imageUrl?: string;
  cooldownLabel?: string;
}

export function formatRankValues(values: Array<number | null>): string {
  const compact = values.length > 1 && values.every((value) => value === values[0]) ? [values[0]] : values;
  return compact.map((value) => (value == null ? '—' : String(value))).join('/');
}

export function formatAbilityHint(
  cooldown?: Array<number | null> | null,
  cost?: { type: string; values: Array<number | null> } | null,
): string | undefined {
  const parts: string[] = [];
  if (cooldown?.length) {
    parts.push(`${formatRankValues(cooldown)}s`);
  }
  if (cost?.values.length) {
    parts.push(`${formatRankValues(cost.values)} ${cost.type.replace(/_/g, ' ')}`);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function composeAbilityText(
  description?: string | null,
  numericSummary?: string | null,
): string {
  return [description, numericSummary]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

const LOCAL_ABILITY_ART: Record<string, Partial<Record<string, string>>> = {
  darius: {
    P: '/abilities/darius-passive.png',
    Q: '/abilities/darius-q.png',
    W: '/abilities/darius-w.png',
    E: '/abilities/darius-e.png',
    R: '/abilities/darius-r.png',
  },
  garen: {
    P: '/abilities/garen-passive.png',
    Q: '/abilities/garen-q.png',
    W: '/abilities/garen-w.png',
    E: '/abilities/garen-e.png',
    R: '/abilities/garen-r.png',
  },
  gwen: {
    P: '/abilities/gwen-passive.avif',
    Q: '/abilities/gwen-q.avif',
    W: '/abilities/gwen-w.avif',
    E: '/abilities/gwen-e.avif',
    R: '/abilities/gwen-r.avif',
  },
};

export function localAbilityArt(slug: string, key: string): string | undefined {
  return LOCAL_ABILITY_ART[slug]?.[key];
}

/** Scraped kit plus snapshot numbers when the API has ingested them. */
export function resolveAbilities(fromApi?: AbilityDto[] | null, slug?: string): AbilityInfo[] {
  if (!fromApi?.length) return [];
  return fromApi.map((ability) => ({
    key: ability.key,
    name: ability.name,
    description: composeAbilityText(ability.description, ability.numericSummary),
    imageUrl: ability.imageUrl || (slug ? localAbilityArt(slug, ability.key) : undefined),
    cooldownLabel: formatAbilityHint(ability.cooldown, ability.cost),
  }));
}
