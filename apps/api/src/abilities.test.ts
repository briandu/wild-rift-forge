import { describe, expect, it } from 'vitest';
import { toAbilityDtos } from './abilities';
import type { StoredChampionAbility } from '@wild-rift-forge/database';

const row = {
  id: 1,
  championId: 9,
  slot: '1',
  name: 'Rupture',
  description: 'Knocks up in an area.',
  iconUrl: 'https://example.com/q.png',
  videoUrl: null,
  sortOrder: 1,
  cooldown: [6, 6, 6, 6],
  cost: { type: 'mana', values: [60, 60, 60, 60] },
  numericSummary: 'Damage 70/110/150/190 (+70% AP).',
  snapshotPatch: '7.2c',
  gameplaySource: 'wildriftfire_baseline',
} satisfies StoredChampionAbility;

describe('toAbilityDtos', () => {
  it('passes snapshot numbers through without rewriting Riot text', () => {
    expect(toAbilityDtos([row])).toEqual([
      {
        key: 'Q',
        name: 'Rupture',
        description: 'Knocks up in an area.',
        imageUrl: 'https://example.com/q.png',
        videoUrl: undefined,
        cooldown: [6, 6, 6, 6],
        cost: { type: 'mana', values: [60, 60, 60, 60] },
        numericSummary: 'Damage 70/110/150/190 (+70% AP).',
        snapshotPatch: '7.2c',
      },
    ]);
  });
});
