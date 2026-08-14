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

/** Scraped kit plus snapshot numbers when the API has ingested them. */
export function resolveAbilities(fromApi?: AbilityDto[] | null): AbilityInfo[] {
  if (!fromApi?.length) return [];
  return fromApi.map((ability) => ({
    key: ability.key,
    name: ability.name,
    description: composeAbilityText(ability.description, ability.numericSummary),
    imageUrl: ability.imageUrl,
    cooldownLabel: formatAbilityHint(ability.cooldown, ability.cost),
  }));
}
