import type { BaselineAbility, BaselineAbilitySlot } from './baseline';

export const DB_SLOT_BY_BASELINE: Record<
  BaselineAbilitySlot,
  'passive' | '1' | '2' | '3' | 'ultimate'
> = {
  P: 'passive',
  Q: '1',
  W: '2',
  E: '3',
  R: 'ultimate',
};

export const SORT_ORDER_BY_BASELINE: Record<BaselineAbilitySlot, number> = {
  P: 0,
  Q: 1,
  W: 2,
  E: 3,
  R: 4,
};

/** Strip punctuation and hyphens so `chogath` matches Riot `cho-gath`. */
export function compactChampionId(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function championIdsMatch(left: string, right: string): boolean {
  return compactChampionId(left) === compactChampionId(right);
}

/** Last path segment of a Riot champion URL, or null. */
export function slugFromOfficialUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  const match = url.replace(/\/+$/, '').match(/\/champions\/([^/?#]+)$/i);
  return match?.[1] ?? null;
}

/**
 * One ability per kit slot. Prefers a formless row; otherwise the first
 * form (Kayn Shadow Assassin before Rhaast). Extra forms are not merged.
 */
export function pickBaselineAbilityForSlot(
  abilities: BaselineAbility[],
  slot: BaselineAbilitySlot,
): BaselineAbility | undefined {
  const matches = abilities.filter((ability) => ability.slot === slot);
  return matches.find((ability) => ability.form == null) ?? matches[0];
}
