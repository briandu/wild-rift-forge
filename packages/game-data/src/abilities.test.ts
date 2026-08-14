import { describe, expect, it } from 'vitest';
import { matchAbilityByName, normalizeAbilityName, patchAbilityKey } from './abilities';

const kogmaw = [
  { key: 'P', name: 'Icathian Surprise' },
  { key: 'Q', name: 'Caustic Spittle' },
  { key: 'W', name: 'Bio-Arcane Barrage' },
  { key: 'E', name: 'Void Ooze' },
  { key: 'R', name: 'Living Artillery' },
];

const leeSin = [
  { key: 'W', name: 'Safeguard' },
  { key: 'E', name: 'Tempest' },
];

describe('normalizeAbilityName', () => {
  it('strips slot prefixes and punctuation', () => {
    expect(normalizeAbilityName("R - Living Artillery")).toBe('living artillery');
    expect(normalizeAbilityName("Kai'Sa")).toBe('kaisa');
  });
});

describe('matchAbilityByName', () => {
  it('matches Riot patch titles to kit names', () => {
    expect(matchAbilityByName(kogmaw, 'Living Artillery')?.key).toBe('R');
    expect(matchAbilityByName(kogmaw, 'living artillery')?.key).toBe('R');
  });

  it('matches slash-combined titles to either half', () => {
    expect(matchAbilityByName(leeSin, 'Safeguard/Iron Will')?.key).toBe('W');
  });

  it('resolves slot labels', () => {
    expect(matchAbilityByName(kogmaw, 'Ultimate')?.key).toBe('R');
    expect(matchAbilityByName(kogmaw, 'Passive')?.key).toBe('P');
  });

  it('ignores base-stat sections', () => {
    expect(matchAbilityByName(kogmaw, 'Base Stats')).toBeUndefined();
  });
});

describe('patchAbilityKey', () => {
  it('returns the kit hotkey instead of the name initial', () => {
    expect(patchAbilityKey('Living Artillery', kogmaw)).toBe('R');
    expect(patchAbilityKey('Vorpal Spikes', [{ key: 'E', name: 'Vorpal Spikes' }])).toBe('E');
  });

  it('keeps section fallbacks when no kit matches', () => {
    expect(patchAbilityKey('Base Stats', kogmaw)).toBe('Base');
    expect(patchAbilityKey('Prowl', [])).toBe('P');
    expect(patchAbilityKey(null)).toBe('—');
  });
});
