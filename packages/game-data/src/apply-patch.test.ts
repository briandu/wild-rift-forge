import { describe, expect, it } from 'vitest';
import { applyPatch } from './apply-patch';
import type { ChampionGameplaySnapshot, NormalizedPatchChange } from './baseline';

function snapshot(): ChampionGameplaySnapshot {
  const source = { type: 'wildriftfire_baseline' as const, patch: '7.2c' };
  return {
    id: 'chogath',
    name: "Cho'Gath",
    snapshotPatch: '7.2c',
    officialChampionUrl: null,
    bootstrapSourceUrl: null,
    dataStatus: 'extracted',
    level1Stats: {
      health: 690,
      healthRegen5s: 8,
      mana: 380,
      manaRegen5s: 12,
      armor: 46,
      magicResist: 40,
      moveSpeed: 350,
      attackDamage: 62,
      attackSpeed: 0.8,
      resourceNote: null,
    },
    abilities: [
      {
        slot: 'R',
        name: 'Feast',
        form: null,
        cooldown: { value: [80, 70, 60], source, verified: false },
        cost: { value: null, source, verified: false },
        structured: {},
        rawNumericSummary: 'placeholder',
        sourceQuality: 'wildriftfire_baseline',
      },
    ],
    gaps: [],
    warnings: [],
    verification: {
      baselineNumericSource: 'wildriftfire_baseline',
      officialPatchVerifiedFields: [],
      manualIngameVerified: false,
      baselineNumericSourceUrl: null,
      baselinePatch: '7.2c',
      baselineLastChecked: null,
      baselineStatus: 'normalized',
    },
    wildriftfireReference: null,
    generatedFrom: { baseline: '7.2c', patches: [] },
    generatedAt: '2026-08-14T00:00:00.000Z',
  };
}

describe('applyPatch', () => {
  it('updates a mapped cooldown and records the patch', () => {
    const change: NormalizedPatchChange = {
      champion: "Cho'Gath",
      championId: 'chogath',
      ability: 'Feast',
      field: 'cooldown_s',
      before: [80, 70, 60],
      after: [70, 60, 50],
      source: { type: 'riot_patch_notes', patch: '7.2d' },
    };
    const result = applyPatch(snapshot(), [change], '7.2d');
    expect(result.applied).toEqual(['Feast.cooldown_s']);
    expect(result.snapshot.abilities[0]?.cooldown.value).toEqual([70, 60, 50]);
    expect(result.snapshot.abilities[0]?.cooldown.verified).toBe(true);
    expect(result.snapshot.generatedFrom.patches).toEqual(['7.2d']);
    expect(result.snapshot.snapshotPatch).toBe('7.2d');
  });

  it('skips prose-only fields instead of guessing', () => {
    const change: NormalizedPatchChange = {
      champion: "Cho'Gath",
      championId: 'chogath',
      ability: 'Vorpal Spikes',
      field: 'base_damage_and_max_hp_scaling',
      before: 'old',
      after: 'new',
      source: { type: 'riot_patch_notes', patch: '7.2d' },
    };
    const result = applyPatch(snapshot(), [change], '7.2d');
    expect(result.applied).toEqual([]);
    expect(result.skipped[0]?.field).toBe('Vorpal Spikes.base_damage_and_max_hp_scaling');
  });
});
