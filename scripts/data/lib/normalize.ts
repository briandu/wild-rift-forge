import {
  championIdFromName,
  type AbilityCost,
  type AbilityCostType,
  type BaselineAbility,
  type BaselineAbilitySlot,
  type ChampionGameplaySnapshot,
  type DataSourceRef,
  type DataStatus,
  type NormalizedPatchChange,
  type NormalizedPatchRecord,
  type Provenanced,
} from '@wild-rift-forge/game-data';
import type { RawAbility, RawBaselineFile, RawChampion, RawPatchChange } from './raw';

const SLOTS = new Set<BaselineAbilitySlot>(['P', 'Q', 'W', 'E', 'R']);
const COST_TYPES = new Set<AbilityCostType>(['mana', 'energy', 'health', 'mana_per_second']);
const STATUSES = new Set<DataStatus>(['extracted', 'partial', 'needs_extraction', 'needs_review']);

function sourceFromChampion(champion: RawChampion): DataSourceRef {
  return {
    type: 'wildriftfire_baseline',
    patch: champion.snapshot_patch,
    url: champion.bootstrap_source_url,
  };
}

function provenanced<T>(value: T, source: DataSourceRef, verified = false): Provenanced<T> {
  return { value, source, verified };
}

function normalizeCost(raw: RawAbility['cost']): AbilityCost | null {
  if (!raw) {
    return null;
  }
  if (!COST_TYPES.has(raw.type as AbilityCostType)) {
    throw new Error(`Unknown cost type: ${raw.type}`);
  }
  return { type: raw.type as AbilityCostType, values: raw.values };
}

function normalizeAbility(raw: RawAbility, source: DataSourceRef): BaselineAbility {
  if (!SLOTS.has(raw.slot as BaselineAbilitySlot)) {
    throw new Error(`Unknown ability slot: ${raw.slot}`);
  }
  return {
    slot: raw.slot as BaselineAbilitySlot,
    name: raw.name,
    form: raw.form ?? null,
    cooldown: provenanced(raw.cooldown_s, source),
    cost: provenanced(normalizeCost(raw.cost), source),
    structured: {},
    rawNumericSummary: raw.numeric_summary,
    sourceQuality: raw.source_quality,
  };
}

export function normalizeChampion(raw: RawChampion, generatedAt: string): ChampionGameplaySnapshot {
  if (!STATUSES.has(raw.data_status as DataStatus)) {
    throw new Error(`${raw.id}: invalid data_status ${raw.data_status}`);
  }
  const source = sourceFromChampion(raw);
  const stats = raw.level1_stats;
  return {
    id: raw.id,
    name: raw.name,
    snapshotPatch: raw.snapshot_patch,
    officialChampionUrl: raw.official_champion_url,
    bootstrapSourceUrl: raw.bootstrap_source_url,
    dataStatus: raw.data_status as DataStatus,
    level1Stats: {
      health: stats.health,
      healthRegen5s: stats.health_regen_5s,
      mana: stats.mana,
      manaRegen5s: stats.mana_regen_5s,
      armor: stats.armor,
      magicResist: stats.magic_resist,
      moveSpeed: stats.move_speed,
      attackDamage: stats.attack_damage,
      attackSpeed: stats.attack_speed,
      resourceNote: stats.resource_note ?? null,
    },
    abilities: raw.abilities.map((ability) => normalizeAbility(ability, source)),
    gaps: [...raw.gaps],
    warnings: [...raw.warnings],
    verification: {
      baselineNumericSource: raw.verification.baseline_numeric_source,
      officialPatchVerifiedFields: raw.verification.official_patch_verified_fields.map((field) => ({
        patch: field.patch,
        deltaIndex: field.delta_index,
      })),
      manualIngameVerified: raw.verification.manual_ingame_verified,
      baselineNumericSourceUrl: raw.verification.baseline_numeric_source_url,
      baselinePatch: raw.verification.baseline_patch,
      baselineLastChecked: raw.verification.baseline_last_checked,
      baselineStatus: raw.verification.baseline_status,
    },
    wildriftfireReference: {
      provider: raw.wildriftfire_reference.provider,
      sourceType: raw.wildriftfire_reference.source_type,
      guideUrl: raw.wildriftfire_reference.guide_url,
      observedPatch: raw.wildriftfire_reference.observed_patch,
      checkedAt: raw.wildriftfire_reference.checked_at,
      normalizationStatus: raw.wildriftfire_reference.normalization_status,
      note: raw.wildriftfire_reference.note,
    },
    generatedFrom: {
      baseline: raw.snapshot_patch,
      patches: [],
    },
    generatedAt,
  };
}

export function normalizePatchChange(change: RawPatchChange, patch: string, sourceUrl: string): NormalizedPatchChange {
  return {
    champion: change.champion,
    championId: championIdFromName(change.champion),
    ability: change.section === 'Base Stats' ? null : change.section,
    field: change.field,
    before: change.before,
    after: change.after,
    source: {
      type: 'riot_patch_notes',
      patch,
      url: sourceUrl,
    },
  };
}

export function normalizePatchRecord(file: RawBaselineFile, patch: string): NormalizedPatchRecord | null {
  const raw = file.official_patch_deltas[patch];
  if (!raw) {
    return null;
  }
  return {
    patch,
    date: raw.date ?? null,
    sourceUrl: raw.source ?? '',
    scope: raw.scope ?? null,
    changes: raw.changes.map((change) => normalizePatchChange(change, patch, raw.source ?? '')),
  };
}
