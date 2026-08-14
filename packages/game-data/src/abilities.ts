import type { AbilityHotkey, AbilitySlot } from './index';

const GENERIC_SECTIONS = new Set(['base stats', 'general', 'overview', 'notes']);

const SLOT_ALIASES: Record<string, AbilityHotkey> = {
  p: 'P',
  passive: 'P',
  q: 'Q',
  '1': 'Q',
  ability1: 'Q',
  'ability 1': 'Q',
  w: 'W',
  '2': 'W',
  ability2: 'W',
  'ability 2': 'W',
  e: 'E',
  '3': 'E',
  ability3: 'E',
  'ability 3': 'E',
  r: 'R',
  ult: 'R',
  ultimate: 'R',
};

const SLOT_PREFIX =
  /^(p|q|w|e|r|passive|ultimate|ult|ability\s*[123])\s*[-–:]\s*/i;

export type NamedAbility = {
  name: string;
  key?: string;
  slot?: AbilitySlot;
};

/** Collapse Riot / kit ability titles for comparison. */
export function normalizeAbilityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(SLOT_PREFIX, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Map a patch-notes ability title (e.g. "Living Artillery") onto a scraped kit
 * row. Riot titles are names, not Q/W/E/R keys.
 */
export function matchAbilityByName<T extends NamedAbility>(
  abilities: T[],
  rawName: string | null | undefined,
): T | undefined {
  if (!rawName || abilities.length === 0) {
    return undefined;
  }
  const normalized = normalizeAbilityName(rawName);
  if (!normalized || GENERIC_SECTIONS.has(normalized)) {
    return undefined;
  }

  const exact = abilities.find((ability) => normalizeAbilityName(ability.name) === normalized);
  if (exact) {
    return exact;
  }

  for (const part of rawName.split('/')) {
    const partNorm = normalizeAbilityName(part);
    if (!partNorm || partNorm === normalized) {
      continue;
    }
    const hit = abilities.find((ability) => normalizeAbilityName(ability.name) === partNorm);
    if (hit) {
      return hit;
    }
  }

  const alias = SLOT_ALIASES[normalized];
  if (alias) {
    return abilities.find((ability) => abilityKey(ability) === alias);
  }

  if (normalized.length < 4) {
    return undefined;
  }
  const contains = abilities.filter((ability) => {
    const name = normalizeAbilityName(ability.name);
    return name.includes(normalized) || normalized.includes(name);
  });
  return contains.length === 1 ? contains[0] : undefined;
}

/** Hotkey for a patch line: kit match, then section fallbacks, then first letter. */
export function patchAbilityKey(
  abilityName: string | null,
  abilities: NamedAbility[] = [],
): string {
  if (!abilityName) {
    return '—';
  }
  if (/base stats/i.test(abilityName)) {
    return 'Base';
  }
  const matched = matchAbilityByName(abilities, abilityName);
  const key = matched ? abilityKey(matched) : undefined;
  if (key) {
    return key;
  }
  if (/^passive$/i.test(abilityName)) {
    return 'P';
  }
  return abilityName.slice(0, 1).toUpperCase();
}

function abilityKey(ability: NamedAbility): string | undefined {
  if (ability.key) {
    return ability.key;
  }
  if (ability.slot === 'passive') {
    return 'P';
  }
  if (ability.slot === '1') {
    return 'Q';
  }
  if (ability.slot === '2') {
    return 'W';
  }
  if (ability.slot === '3') {
    return 'E';
  }
  if (ability.slot === 'ultimate') {
    return 'R';
  }
  return undefined;
}
