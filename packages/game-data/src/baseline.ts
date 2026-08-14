import { z } from 'zod';

export const DATA_STATUSES = ['extracted', 'partial', 'needs_extraction', 'needs_review'] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

export const ABILITY_SLOTS = ['P', 'Q', 'W', 'E', 'R'] as const;
export type BaselineAbilitySlot = (typeof ABILITY_SLOTS)[number];

export const COST_TYPES = ['mana', 'energy', 'health', 'mana_per_second'] as const;
export type AbilityCostType = (typeof COST_TYPES)[number];

export const SOURCE_TYPES = [
  'riot_patch_notes',
  'riot_website',
  'manual_ingame',
  'wildriftfire_baseline',
  'other_community',
] as const;
export type DataSourceType = (typeof SOURCE_TYPES)[number];

export interface DataSourceRef {
  type: DataSourceType;
  patch: string;
  url?: string;
}

export interface Provenanced<T> {
  value: T;
  source: DataSourceRef;
  verified: boolean;
}

export interface AbilityCost {
  type: AbilityCostType;
  values: Array<number | null>;
}

export interface ChampionLevel1Stats {
  health: number | null;
  healthRegen5s: number | null;
  mana: number | null;
  manaRegen5s: number | null;
  armor: number | null;
  magicResist: number | null;
  moveSpeed: number | null;
  attackDamage: number | null;
  attackSpeed: number | null;
  resourceNote: string | null;
}

export interface BaselineAbility {
  slot: BaselineAbilitySlot;
  name: string;
  form: string | null;
  cooldown: Provenanced<Array<number | null> | null>;
  cost: Provenanced<AbilityCost | null>;
  structured: Record<string, unknown>;
  rawNumericSummary: string;
  sourceQuality: string;
}

export interface OfficialFieldRef {
  patch: string;
  deltaIndex: number;
}

export interface ChampionVerification {
  baselineNumericSource: string;
  officialPatchVerifiedFields: OfficialFieldRef[];
  manualIngameVerified: boolean;
  baselineNumericSourceUrl: string | null;
  baselinePatch: string;
  baselineLastChecked: string | null;
  baselineStatus: string;
}

export interface WildRiftFireReference {
  provider: string;
  sourceType: string;
  guideUrl: string;
  observedPatch: string;
  checkedAt: string;
  normalizationStatus: string;
  note: string;
}

export interface SnapshotOrigin {
  baseline: string;
  patches: string[];
}

export interface ChampionGameplaySnapshot {
  id: string;
  name: string;
  snapshotPatch: string;
  officialChampionUrl: string | null;
  bootstrapSourceUrl: string | null;
  dataStatus: DataStatus;
  level1Stats: ChampionLevel1Stats;
  abilities: BaselineAbility[];
  gaps: string[];
  warnings: string[];
  verification: ChampionVerification;
  wildriftfireReference: WildRiftFireReference | null;
  generatedFrom: SnapshotOrigin;
  generatedAt: string;
}

export interface NormalizedPatchChange {
  champion: string;
  championId: string;
  ability: string | null;
  field: string;
  before: unknown;
  after: unknown;
  source: DataSourceRef;
}

export interface NormalizedPatchRecord {
  patch: string;
  date: string | null;
  sourceUrl: string;
  scope: string | null;
  changes: NormalizedPatchChange[];
}

export const numberArraySchema = z.array(z.number().finite().nullable());

export const abilityCostSchema = z.object({
  type: z.enum(COST_TYPES),
  values: numberArraySchema,
});

export const dataSourceRefSchema = z.object({
  type: z.enum(SOURCE_TYPES),
  patch: z.string().min(1),
  url: z.string().url().optional(),
});

export function provenancedSchema<T extends z.ZodTypeAny>(value: T) {
  return z.object({
    value,
    source: dataSourceRefSchema,
    verified: z.boolean(),
  });
}

export const championLevel1StatsSchema = z.object({
  health: z.number().finite().nullable(),
  healthRegen5s: z.number().finite().nullable(),
  mana: z.number().finite().nullable(),
  manaRegen5s: z.number().finite().nullable(),
  armor: z.number().finite().nullable(),
  magicResist: z.number().finite().nullable(),
  moveSpeed: z.number().finite().nullable(),
  attackDamage: z.number().finite().nullable(),
  attackSpeed: z.number().finite().nullable(),
  resourceNote: z.string().nullable(),
});

export const baselineAbilitySchema = z.object({
  slot: z.enum(ABILITY_SLOTS),
  name: z.string().min(1),
  form: z.string().nullable(),
  cooldown: provenancedSchema(numberArraySchema.nullable()),
  cost: provenancedSchema(abilityCostSchema.nullable()),
  structured: z.record(z.unknown()),
  rawNumericSummary: z.string(),
  sourceQuality: z.string(),
});

export const championGameplaySnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  snapshotPatch: z.string().min(1),
  officialChampionUrl: z.string().nullable(),
  bootstrapSourceUrl: z.string().nullable(),
  dataStatus: z.enum(DATA_STATUSES),
  level1Stats: championLevel1StatsSchema,
  abilities: z.array(baselineAbilitySchema).min(1),
  gaps: z.array(z.string()),
  warnings: z.array(z.string()),
  verification: z.object({
    baselineNumericSource: z.string(),
    officialPatchVerifiedFields: z.array(
      z.object({
        patch: z.string(),
        deltaIndex: z.number().int().nonnegative(),
      }),
    ),
    manualIngameVerified: z.boolean(),
    baselineNumericSourceUrl: z.string().nullable(),
    baselinePatch: z.string(),
    baselineLastChecked: z.string().nullable(),
    baselineStatus: z.string(),
  }),
  wildriftfireReference: z
    .object({
      provider: z.string(),
      sourceType: z.string(),
      guideUrl: z.string(),
      observedPatch: z.string(),
      checkedAt: z.string(),
      normalizationStatus: z.string(),
      note: z.string(),
    })
    .nullable(),
  generatedFrom: z.object({
    baseline: z.string(),
    patches: z.array(z.string()),
  }),
  generatedAt: z.string(),
});

export const normalizedPatchRecordSchema = z.object({
  patch: z.string().min(1),
  date: z.string().nullable(),
  sourceUrl: z.string(),
  scope: z.string().nullable(),
  changes: z.array(
    z.object({
      champion: z.string(),
      championId: z.string(),
      ability: z.string().nullable(),
      field: z.string(),
      before: z.unknown(),
      after: z.unknown(),
      source: dataSourceRefSchema,
    }),
  ),
});

export function championIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

