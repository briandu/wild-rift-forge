import { normalizeAbilityName } from './abilities';
import type {
  ChampionGameplaySnapshot,
  ChampionLevel1Stats,
  NormalizedPatchChange,
  Provenanced,
} from './baseline';

const STAT_FIELDS: Record<string, keyof ChampionLevel1Stats> = {
  base_health: 'health',
  base_armor: 'armor',
  base_magic_resist: 'magicResist',
  base_attack_damage: 'attackDamage',
  base_attack_speed: 'attackSpeed',
  base_move_speed: 'moveSpeed',
  base_mana: 'mana',
};

export interface ApplyPatchResult {
  snapshot: ChampionGameplaySnapshot;
  applied: string[];
  skipped: Array<{ field: string; reason: string }>;
}

function asNumberArray(value: unknown): Array<number | null> | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  if (!value.every((item) => item === null || (typeof item === 'number' && Number.isFinite(item)))) {
    return null;
  }
  return value;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function withValue<T>(current: Provenanced<T>, value: T, patch: string, url?: string): Provenanced<T> {
  return {
    value,
    source: { type: 'riot_patch_notes', patch, url },
    verified: true,
  };
}

function findAbility(snapshot: ChampionGameplaySnapshot, section: string | null) {
  if (!section) {
    return null;
  }
  const want = normalizeAbilityName(section);
  return (
    snapshot.abilities.find((ability) => normalizeAbilityName(ability.name) === want) ??
    snapshot.abilities.find((ability) => normalizeAbilityName(ability.name).includes(want)) ??
    null
  );
}

/**
 * Apply structured Riot deltas onto a champion snapshot.
 * Prose-only or unmapped fields are skipped — never guessed into structured numbers.
 */
export function applyPatch(
  snapshot: ChampionGameplaySnapshot,
  changes: NormalizedPatchChange[],
  patch: string,
): ApplyPatchResult {
  const next: ChampionGameplaySnapshot = {
    ...snapshot,
    level1Stats: { ...snapshot.level1Stats },
    abilities: snapshot.abilities.map((ability) => ({
      ...ability,
      cooldown: { ...ability.cooldown },
      cost: { ...ability.cost, value: ability.cost.value ? { ...ability.cost.value } : null },
      structured: { ...ability.structured },
    })),
    gaps: [...snapshot.gaps],
    warnings: [...snapshot.warnings],
    generatedFrom: {
      baseline: snapshot.generatedFrom.baseline,
      patches: [...snapshot.generatedFrom.patches, patch],
    },
    snapshotPatch: patch,
  };

  const applied: string[] = [];
  const skipped: Array<{ field: string; reason: string }> = [];
  const sourceUrl = changes[0]?.source.url;

  for (const change of changes) {
    const label = `${change.ability ?? 'base'}.${change.field}`;
    if (change.field === 'cooldown_s') {
      const ability = findAbility(next, change.ability);
      const values = asNumberArray(change.after);
      if (!ability || !values) {
        skipped.push({ field: label, reason: 'cooldown is not a numeric array or ability was not found' });
        continue;
      }
      ability.cooldown = withValue(ability.cooldown, values, patch, sourceUrl);
      applied.push(label);
      continue;
    }

    const statKey = STAT_FIELDS[change.field];
    if (statKey) {
      const value = asNumber(change.after);
      if (value === null) {
        skipped.push({ field: label, reason: 'stat after-value is not a finite number' });
        continue;
      }
      next.level1Stats = { ...next.level1Stats, [statKey]: value };
      applied.push(label);
      continue;
    }

    skipped.push({
      field: label,
      reason: 'no structured mapping; left in patch history and rawNumericSummary',
    });
  }

  return { snapshot: next, applied, skipped };
}
