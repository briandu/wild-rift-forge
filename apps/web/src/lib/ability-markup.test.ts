import { describe, expect, it } from 'vitest';
import { inferAbilityTags, parseAbilityMarkup } from './ability-markup';

function painted(text: string) {
  return parseAbilityMarkup(text)
    .filter((seg) => seg.kind !== 'text')
    .map((seg) => [seg.kind, seg.t, seg.icon ?? ''] as const);
}

describe('parseAbilityMarkup', () => {
  it('leaves plain copy alone', () => {
    expect(parseAbilityMarkup('Dashes in a target direction.')).toEqual([
      { kind: 'text', t: 'Dashes in a target direction.' },
    ]);
  });

  it('colors physical damage, the leading value, and AD scaling', () => {
    expect(
      painted('dealing 57 physical damage (10 + 75% AD). Enemies will be knocked up.'),
    ).toEqual([
      ['physical', '57', ''],
      ['physical', 'physical damage', ''],
      ['ad', '75%', 'ad'],
      ['cc', 'knocked up', ''],
    ]);
  });

  it('colors magic damage and AP scaling inside parentheses', () => {
    expect(painted('dealing 80 / 130 / 180 / 230 (+85% AP) magic damage')).toEqual([
      ['magic', '80 / 130 / 180 / 230', ''],
      ['ap', '+85%', 'ap'],
      ['magic', 'magic damage', ''],
    ]);
  });

  it('splits mixed AD and AP ratios onto their own icons', () => {
    expect(painted('restoring 40 / 70 / 100 / 130 (+40% AD +25% AP) Health')).toEqual([
      ['heal', 'restoring', ''],
      ['heal', '40 / 70 / 100 / 130', ''],
      ['ad', '+40%', 'ad'],
      ['ap', '+25%', 'ap'],
      ['health', 'Health', ''],
    ]);
  });

  it('colors heal verbs and the amounts after for', () => {
    expect(
      painted('he heals himself for 27 and nearby allied champions for 54.'),
    ).toEqual([
      ['heal', 'heals', ''],
      ['heal', '27', ''],
      ['heal', '54', ''],
    ]);
  });

  it('marks minion notes dimmer than the main effect', () => {
    expect(painted('Deals 65% damage to minions.')).toEqual([['note', 'Deals 65% damage to minions.', '']]);
  });

  it('keeps ranked AD ratios on one icon and drops the stat word', () => {
    const segs = parseAbilityMarkup('Empowers the attack (+35% / 40% / 45% / 50% AD).');
    expect(segs.filter((seg) => seg.kind === 'ad')).toEqual([
      { kind: 'ad', t: '+35% / 40% / 45% / 50%', icon: 'ad' },
    ]);
    expect(segs.some((seg) => seg.t.includes('AD'))).toBe(false);
  });
});

describe('inferAbilityTags', () => {
  it('uses Passive plus Heal for a self-heal passive', () => {
    expect(inferAbilityTags('P', 'When Alistar takes damage, he heals himself.')).toEqual([
      { label: 'Passive', tone: 'passive' },
      { label: 'Heal', tone: 'heal' },
    ]);
  });

  it('pairs a damage type with Control', () => {
    expect(inferAbilityTags('Q', 'dealing 60 magic damage and knocks them up.')).toEqual([
      { label: 'Magic', tone: 'magic' },
      { label: 'Control', tone: 'control' },
    ]);
  });

  it('uses Buff when the kit cleanses or only grants a speed', () => {
    expect(inferAbilityTags('R', 'Removes crowd control effects and gain 55% damage reduction.')).toEqual([
      { label: 'Buff', tone: 'buff' },
    ]);
    expect(inferAbilityTags('W', 'Gains 45% Movement Speed for 1.5 seconds.')).toEqual([
      { label: 'Buff', tone: 'buff' },
    ]);
  });
});
