import { describe, expect, it } from 'vitest';
import { composeAbilityText, formatAbilityHint, localAbilityArt, resolveAbilities } from './abilities';

describe('resolveAbilities', () => {
  it('uses scraped kit text and does not invent a blank kit', () => {
    expect(resolveAbilities(null)).toEqual([]);
    expect(resolveAbilities([])).toEqual([]);
    expect(
      resolveAbilities([{ key: 'Q', name: 'Snip Snip!', description: 'Six snips.' }]),
    ).toEqual([
      {
        key: 'Q',
        name: 'Snip Snip!',
        description: 'Six snips.',
        imageUrl: undefined,
        cooldownLabel: undefined,
      },
    ]);
  });

  it('appends snapshot numbers and formats cooldown in the hint', () => {
    expect(
      resolveAbilities([
        {
          key: 'Q',
          name: 'Rupture',
          description: 'Knocks up in an area.',
          cooldown: [6, 6, 6, 6],
          cost: { type: 'mana', values: [60, 60, 60, 60] },
          numericSummary: 'Damage 70/110/150/190 (+70% AP).',
        },
      ]),
    ).toEqual([
      {
        key: 'Q',
        name: 'Rupture',
        description: 'Knocks up in an area. Damage 70/110/150/190 (+70% AP).',
        imageUrl: undefined,
        cooldownLabel: '6s · 60 mana',
      },
    ]);
  });
});

describe('formatAbilityHint', () => {
  it('keeps mixed ranks and skips empty fields', () => {
    expect(formatAbilityHint([8, 7, 6, 5], { type: 'mana', values: [50, 60, 70, 80] })).toBe(
      '8/7/6/5s · 50/60/70/80 mana',
    );
    expect(formatAbilityHint(null, null)).toBeUndefined();
  });
});

describe('localAbilityArt', () => {
  it('falls back to handoff icons for Garen and Darius', () => {
    expect(localAbilityArt('garen', 'Q')).toBe('/abilities/garen-q.png');
    expect(localAbilityArt('darius', 'R')).toBe('/abilities/darius-r.png');
    expect(
      resolveAbilities([{ key: 'Q', name: 'Decisive Strike', description: 'Silence.' }], 'garen')[0]?.imageUrl,
    ).toBe('/abilities/garen-q.png');
  });
});

describe('composeAbilityText', () => {
  it('uses numbers when Riot text is empty', () => {
    expect(composeAbilityText('', 'Kill restores health.')).toBe('Kill restores health.');
  });
});
