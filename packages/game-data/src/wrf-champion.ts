import { z } from 'zod';

export const PARSE_CONFIDENCE = ['high', 'medium', 'low', 'manual_review'] as const;
export type ParseConfidence = (typeof PARSE_CONFIDENCE)[number];

export const GAP_KINDS = ['missing_from_source', 'parser_failed'] as const;
export type GapKind = (typeof GAP_KINDS)[number];

export const WRF_ABILITY_SLOTS = ['passive', 'q', 'w', 'e', 'r'] as const;
export type WrfAbilitySlot = (typeof WRF_ABILITY_SLOTS)[number];

export const RESOURCE_TYPES = ['none', 'mana', 'energy', 'health', 'other'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const DAMAGE_TYPES = ['physical', 'magic', 'true', 'mixed'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const EFFECT_TYPES = [
  'damage',
  'heal',
  'shield',
  'movement_speed',
  'attack_speed',
  'armor',
  'magic_resistance',
  'armor_reduction',
  'magic_resistance_reduction',
  'slow',
  'stun',
  'root',
  'silence',
  'knockup',
  'knockback',
  'fear',
  'charm',
  'taunt',
  'dash',
  'blink',
  'true_damage',
  'percent_health_damage',
  'missing_health_damage',
  'lifesteal',
  'omnivamp',
  'cooldown_reduction',
  'resource_restore',
  'execute',
  'stack',
  'summon',
  'transformation',
  'other',
] as const;
export type EffectType = (typeof EFFECT_TYPES)[number];

export const SCALING_STATS = [
  'total_ad',
  'bonus_ad',
  'ap',
  'maximum_health',
  'bonus_health',
  'missing_health',
  'target_maximum_health',
  'target_current_health',
  'target_missing_health',
  'armor',
  'magic_resistance',
  'mana',
  'bonus_mana',
  'champion_level',
  'stacks',
] as const;
export type ScalingStat = (typeof SCALING_STATS)[number];

export const rankValueSchema = z.union([z.number().finite(), z.array(z.number().finite().nullable())]);
export type RankValue = z.infer<typeof rankValueSchema>;

export const scalingSchema = z.object({
  stat: z.enum(SCALING_STATS),
  ratio: z.number().finite(),
});
export type AbilityScaling = z.infer<typeof scalingSchema>;

export const abilityEffectSchema = z.object({
  type: z.enum(EFFECT_TYPES),
  damageType: z.enum(DAMAGE_TYPES).optional(),
  base: rankValueSchema.optional(),
  percent: rankValueSchema.optional(),
  duration: rankValueSchema.optional(),
  scalings: z.array(scalingSchema).optional(),
  note: z.string().optional(),
  confidence: z.enum(PARSE_CONFIDENCE),
});
export type AbilityEffect = z.infer<typeof abilityEffectSchema>;

export const abilityStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  rawParsedText: z.string(),
  effects: z.array(abilityEffectSchema),
});
export type AbilityState = z.infer<typeof abilityStateSchema>;

export const abilityCostSchema = z.object({
  type: z.enum(RESOURCE_TYPES),
  values: z.array(z.number().finite().nullable()),
});
export type WrfAbilityCost = z.infer<typeof abilityCostSchema>;

export const wrfAbilitySchema = z.object({
  slot: z.enum(WRF_ABILITY_SLOTS),
  name: z.string().min(1),
  form: z.string().nullable(),
  description: z.object({
    normalized: z.string(),
    source: z.literal('wildriftfire'),
  }),
  cooldown: z.array(z.number().finite().nullable()).nullable(),
  cost: abilityCostSchema.nullable(),
  effects: z.array(abilityEffectSchema),
  states: z.array(abilityStateSchema).optional(),
  rawParsedText: z.string(),
  confidence: z.enum(PARSE_CONFIDENCE),
});
export type WrfAbility = z.infer<typeof wrfAbilitySchema>;

export const championResourceSchema = z.object({
  type: z.enum(RESOURCE_TYPES),
  maximum: z.number().finite().nullable(),
  maximumPerLevel: z.number().finite().nullable(),
  regen5: z.number().finite().nullable(),
  regen5PerLevel: z.number().finite().nullable(),
});
export type ChampionResource = z.infer<typeof championResourceSchema>;

export const wrfChampionStatsSchema = z.object({
  health: z.number().finite().nullable(),
  healthPerLevel: z.number().finite().nullable(),
  healthRegen5: z.number().finite().nullable(),
  healthRegen5PerLevel: z.number().finite().nullable(),
  resource: championResourceSchema,
  attackDamage: z.number().finite().nullable(),
  attackDamagePerLevel: z.number().finite().nullable(),
  attackSpeed: z.number().finite().nullable(),
  attackSpeedPerLevel: z.number().finite().nullable(),
  attackRange: z.number().finite().nullable(),
  armor: z.number().finite().nullable(),
  armorPerLevel: z.number().finite().nullable(),
  magicResistance: z.number().finite().nullable(),
  magicResistancePerLevel: z.number().finite().nullable(),
  movementSpeed: z.number().finite().nullable(),
  additional: z.record(z.object({
    base: z.number().finite(),
    perLevel: z.number().finite().nullable(),
  })),
});
export type WrfChampionStats = z.infer<typeof wrfChampionStatsSchema>;

export const wrfSourceSchema = z.object({
  provider: z.literal('WildRiftFire'),
  sourceType: z.literal('champion_guide'),
  url: z.string().url(),
  observedPatch: z.string().nullable(),
  scrapedAt: z.string(),
});
export type WrfSource = z.infer<typeof wrfSourceSchema>;

export const parseGapSchema = z.object({
  field: z.string(),
  kind: z.enum(GAP_KINDS),
  detail: z.string(),
});
export type ParseGap = z.infer<typeof parseGapSchema>;

export const wrfChampionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().nullable(),
  roles: z.array(z.string()),
  positions: z.array(z.string()),
  imageUrl: z.string().nullable(),
  stats: wrfChampionStatsSchema,
  abilities: z.object({
    passive: wrfAbilitySchema,
    q: wrfAbilitySchema,
    w: wrfAbilitySchema,
    e: wrfAbilitySchema,
    r: wrfAbilitySchema,
  }),
  extraAbilities: z.array(wrfAbilitySchema),
  source: wrfSourceSchema,
  gaps: z.array(parseGapSchema),
  parseWarnings: z.array(z.string()),
});
export type WrfChampion = z.infer<typeof wrfChampionSchema>;

export const wrfIndexEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
});
export type WrfIndexEntry = z.infer<typeof wrfIndexEntrySchema>;
