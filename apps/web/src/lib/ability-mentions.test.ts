import { describe, expect, it } from 'vitest';
import { abilitySlotLabel, parseAbilityMentions } from './ability-mentions';

const kits = {
  Garen: [
    { key: 'Q', name: 'Decisive Strike', description: 'Silence the next hit.', imageUrl: '/q.png' },
    { key: 'W', name: 'Courage', description: 'Damage reduction.', imageUrl: '/w.png' },
    { key: 'E', name: 'Judgment', description: 'Spin.', imageUrl: '/e.png' },
  ],
  Darius: [
    { key: 'Q', name: 'Decimate', description: 'Heals on the blade.', imageUrl: '/dq.png' },
    { key: 'W', name: 'Crippling Strike', description: 'Slow on hit.', imageUrl: '/dw.png' },
    { key: 'E', name: 'Apprehend', description: 'Pulls enemies in.', imageUrl: '/de.png' },
  ],
};

describe('abilitySlotLabel', () => {
  it('maps kit letters to the mock slot names', () => {
    expect(abilitySlotLabel('P')).toBe('PASSIVE');
    expect(abilitySlotLabel('Q')).toBe('ABILITY 1');
    expect(abilitySlotLabel('R')).toBe('ULTIMATE');
  });
});

describe('parseAbilityMentions', () => {
  it('leaves plain copy alone and resolves his/your keys', () => {
    expect(parseAbilityMentions('No keys here.', 'a', { you: 'Garen', them: 'Darius', def: 'Darius', kits })).toEqual([
      { kind: 'text', t: 'No keys here.' },
    ]);
    const segs = parseAbilityMentions('Hold your Q until his E is down.', 'x', {
      you: 'Garen',
      them: 'Darius',
      def: 'Darius',
      kits,
    });
    expect(segs.filter((s) => s.kind === 'abil').map((s) => (s.kind === 'abil' ? [s.champ, s.key, s.name] : []))).toEqual([
      ['Garen', 'Q', 'Decisive Strike'],
      ['Darius', 'E', 'Apprehend'],
    ]);
  });

  it('treats an imperative bare key as your spell, not theirs', () => {
    const segs = parseAbilityMentions('Use Q to run in while Apprehend is ready.', 'bad', {
      you: 'Garen',
      them: 'Darius',
      def: 'Darius',
      kits,
    });
    expect(segs.filter((s) => s.kind === 'abil').map((s) => (s.kind === 'abil' ? [s.champ, s.key, s.name] : []))).toEqual([
      ['Garen', 'Q', 'Decisive Strike'],
      ['Darius', 'E', 'Apprehend'],
    ]);
    const brief = parseAbilityMentions(
      "Use a brief E at close range; stay inside Decimate's blade and cast W into his return damage.",
      'good',
      { you: 'Garen', them: 'Darius', def: 'Darius', kits },
    );
    expect(
      brief.filter((s) => s.kind === 'abil').map((s) => (s.kind === 'abil' ? [s.champ, s.key, s.name] : [])),
    ).toEqual([
      ['Garen', 'E', 'Judgment'],
      ['Darius', 'Q', 'Decimate'],
      ['Garen', 'W', 'Courage'],
    ]);
  });

  it('chips ability names from either kit, including possessives', () => {
    const segs = parseAbilityMentions(
      "Sidestep Apprehend, stay inside Decimate's blade, then Judgment.",
      'n',
      { you: 'Garen', them: 'Darius', def: 'Darius', kits },
    );
    expect(
      segs.filter((s) => s.kind === 'abil').map((s) => (s.kind === 'abil' ? [s.champ, s.name, s.label] : [])),
    ).toEqual([
      ['Darius', 'Apprehend', 'Apprehend'],
      ['Darius', 'Decimate', 'Decimate'],
      ['Garen', 'Judgment', 'Judgment'],
    ]);
    expect(segs.some((s) => s.kind === 'text' && s.t.includes("'s blade"))).toBe(true);
  });
});
