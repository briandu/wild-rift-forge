import { describe, expect, it } from 'vitest';
import type { BaselineAbility } from './baseline';
import {
  championIdsMatch,
  compactChampionId,
  DB_SLOT_BY_BASELINE,
  pickBaselineAbilityForSlot,
  slugFromOfficialUrl,
} from './snapshot';

function ability(slot: BaselineAbility['slot'], name: string, form: string | null): BaselineAbility {
  return {
    slot,
    name,
    form,
    cooldown: {
      value: null,
      source: { type: 'wildriftfire_baseline', patch: '7.2c' },
      verified: false,
    },
    cost: {
      value: null,
      source: { type: 'wildriftfire_baseline', patch: '7.2c' },
      verified: false,
    },
    structured: {},
    rawNumericSummary: `${name} numbers`,
    sourceQuality: 'wildriftfire_baseline',
  };
}

describe('compactChampionId', () => {
  it('matches Riot slugs to baseline ids', () => {
    expect(compactChampionId('cho-gath')).toBe('chogath');
    expect(compactChampionId("Kai'Sa")).toBe('kaisa');
    expect(championIdsMatch('k-sante', 'ksante')).toBe(true);
    expect(championIdsMatch('nunu-willump', 'nunu-willump')).toBe(true);
  });
});

describe('slugFromOfficialUrl', () => {
  it('reads the Riot champion path', () => {
    expect(slugFromOfficialUrl('https://wildrift.leagueoflegends.com/en-us/champions/cho-gath/')).toBe(
      'cho-gath',
    );
    expect(slugFromOfficialUrl(null)).toBeNull();
  });
});

describe('pickBaselineAbilityForSlot', () => {
  it('maps baseline hotkeys onto Riot kit slots', () => {
    expect(DB_SLOT_BY_BASELINE.P).toBe('passive');
    expect(DB_SLOT_BY_BASELINE.R).toBe('ultimate');
  });

  it('prefers a formless row, else the first form', () => {
    const kayn = [
      ability('Q', 'Reaping Slash — Shadow Assassin', 'Shadow Assassin'),
      ability('Q', 'Reaping Slash — Rhaast', 'Rhaast'),
    ];
    expect(pickBaselineAbilityForSlot(kayn, 'Q')?.form).toBe('Shadow Assassin');
    expect(pickBaselineAbilityForSlot([ability('Q', 'Rupture', null), ...kayn], 'Q')?.name).toBe(
      'Rupture',
    );
  });
});
