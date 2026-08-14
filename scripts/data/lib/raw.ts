export interface RawAbilityCost {
  type: string;
  values: number[];
}

export interface RawAbility {
  slot: string;
  name: string;
  form?: string;
  cooldown_s: number[] | null;
  cost: RawAbilityCost | null;
  numeric_summary: string;
  source_quality: string;
}

export interface RawChampion {
  id: string;
  name: string;
  snapshot_patch: string;
  official_champion_url: string;
  bootstrap_source_url: string;
  data_status: string;
  level1_stats: {
    health: number | null;
    health_regen_5s: number | null;
    mana: number | null;
    mana_regen_5s: number | null;
    armor: number | null;
    magic_resist: number | null;
    move_speed: number | null;
    attack_damage: number | null;
    attack_speed: number | null;
    resource_note?: string;
  };
  abilities: RawAbility[];
  gaps: string[];
  warnings: string[];
  verification: {
    baseline_numeric_source: string;
    official_patch_verified_fields: Array<{ patch: string; delta_index: number }>;
    manual_ingame_verified: boolean;
    baseline_numeric_source_url: string;
    baseline_patch: string;
    baseline_last_checked: string;
    baseline_status: string;
  };
  wildriftfire_reference: {
    provider: string;
    source_type: string;
    guide_url: string;
    observed_patch: string;
    checked_at: string;
    normalization_status: string;
    note: string;
  };
}

export interface RawPatchChange {
  champion: string;
  section: string;
  field: string;
  before: unknown;
  after: unknown;
}

export interface RawBaselineFile {
  _meta: Record<string, unknown>;
  official_patch_deltas: Record<
    string,
    {
      date?: string;
      source?: string;
      scope?: string;
      changes: RawPatchChange[];
    }
  >;
  champions: RawChampion[];
}
