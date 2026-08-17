import { describe, expect, it } from 'vitest';
import {
  compactAbility,
  fingerprintContext,
  fingerprintKit,
  hasMatchupGenerationSlot,
  kitRequiresRefresh,
  matchPatchChampion,
  MATCHUP_GUIDE_RULES,
  MATCHUP_PROMPT_VERSION,
  matchupGenerationEnabled,
  parseAbilityNotes,
  parseMatchupGuide,
  parseSpikes,
  explainMatchupGuideRejection,
  parseMatchupLimit,
  type MatchupContextFact,
  type MatchupKitFact,
} from '../src/jobs/generate-matchup';
import type { StoredChampionAbility } from '@wild-rift-forge/database';

const youKit: MatchupKitFact = {
  slug: 'garen',
  name: 'Garen',
  roles: ['fighter'],
  abilities: [
    { key: 'Q', name: 'Decisive Strike', cooldown: [8, 7, 6, 5], cost: null, summary: 'Silence on next attack.' },
  ],
};

const themKit: MatchupKitFact = {
  slug: 'darius',
  name: 'Darius',
  roles: ['fighter'],
  abilities: [
    { key: 'Q', name: 'Decimate', cooldown: [9, 8, 7, 6], cost: null, summary: 'Heals if the blade hits.' },
  ],
};

const context: MatchupContextFact = {
  lane: 'Top',
  youWinRate: 53.3,
  themWinRate: 52.6,
  verdict: 'Garen favoured',
  patchVersion: '7.2c',
  patchLines: [],
  kitBreaking: false,
};

const validGuide = {
  you_slug: 'garen',
  one_thing: 'Do not let Darius extend the fight past two autos.',
  style: 'CAUTIOUS / SHORT TRADES',
  style_pos: 26,
  phases: [
    { n: 'EARLY', t: 'Levels 1–4', body: 'Concede the first two waves and only trade when his Q is down.' },
    { n: 'MID', t: 'Levels 5–10', body: 'Your ultimate creates kill pressure once he is below half health.' },
    { n: 'LATE', t: 'Levels 11+', body: 'Stop duelling him in the side lane and take the fight elsewhere.' },
  ],
  trades: {
    good: {
      steps: ['Darius misses Q', 'Garen Q silence', 'Two autos', 'Walk out'],
      out: 'You win the exchange and reset.',
    },
    bad: {
      steps: ['Hold melee range', 'He keeps autoing', 'Five stacks', 'Execute'],
      out: 'He takes the lane for free.',
    },
  },
  mistakes: [
    'Spending Courage on his Q instead of the execute.',
    'Contesting the first wave into a level-two all-in.',
  ],
  tags: ['Fighter', 'All-in'],
  ability_notes: [
    {
      own: false,
      k: 'Q',
      when: 'If he misses the outer edge',
      then: 'No heal, weak trade',
      win: '~3s punish window',
      note: 'The blade edge is where his healing comes from. Stand chest-to-chest.',
    },
    {
      own: false,
      k: 'E',
      when: 'If the pull whiffs',
      then: 'Long cooldown, no engage',
      win: 'Free trade window',
      note: 'Stay on the far side of the wave so he cannot start the fight.',
    },
    {
      own: false,
      k: 'R',
      when: 'At five Hemorrhage stacks',
      then: 'Execute threshold rises',
      win: 'Leave before stack four',
      note: 'Track your health against his stacks, not against his health bar.',
    },
    {
      own: true,
      k: 'W',
      when: 'Hold it for his ultimate',
      then: 'Not for his Q',
      win: 'Survives the execute',
      note: 'Spending it early is the most common way this matchup is lost.',
    },
  ],
  spikes: [
    { at: 'LVL 1', who: 'them', label: 'Give the first wave. Do not fight.' },
    { at: 'LVL 3', who: 'even', label: 'Short trade only after he misses Decimate.' },
    { at: 'LVL 5', who: 'you', label: 'All-in once your ultimate is up and he is chipped.' },
    { at: '1st ITEM', who: 'even', label: 'Reset before the first item finishes. Do not linger.' },
    { at: 'LVL 11', who: 'them', label: 'Stop side-lane duelling. Group instead.' },
  ],
};

describe('compactAbility', () => {
  it('prefers numeric summary over flavour text', () => {
    const ability = {
      slot: '1',
      name: 'Decimate',
      description: 'A long flavour paragraph that should not be sent to the model.',
      numericSummary: 'Heal on blade hit. 9/8/7/6s.',
      cooldown: [9, 8, 7, 6],
      cost: null,
    } as StoredChampionAbility;
    expect(compactAbility(ability)).toEqual({
      key: 'Q',
      name: 'Decimate',
      cooldown: [9, 8, 7, 6],
      cost: null,
      summary: 'Heal on blade hit. 9/8/7/6s.',
    });
  });
});

describe('fingerprintKit', () => {
  it('is stable for the same kits and ignores lane rates', () => {
    expect(fingerprintKit(youKit, themKit)).toBe(fingerprintKit(youKit, themKit));
  });

  it('changes when an ability number changes', () => {
    const nerfed = {
      ...themKit,
      abilities: [{ ...themKit.abilities[0]!, cooldown: [10, 9, 8, 7] }],
    };
    expect(fingerprintKit(youKit, nerfed)).not.toBe(fingerprintKit(youKit, themKit));
  });
});

describe('fingerprintContext', () => {
  it('changes when lane rates move', () => {
    expect(fingerprintContext({ ...context, youWinRate: 51 })).not.toBe(fingerprintContext(context));
  });
});

describe('kitRequiresRefresh', () => {
  const stored = { kitHash: fingerprintKit(youKit, themKit), promptVersion: MATCHUP_PROMPT_VERSION };

  it('skips when the kit is unchanged and the patch is number-only', () => {
    expect(kitRequiresRefresh(stored, stored.kitHash, false)).toBe(false);
  });

  it('refreshes when the prompt version changes', () => {
    expect(kitRequiresRefresh({ ...stored, promptVersion: MATCHUP_PROMPT_VERSION - 1 }, stored.kitHash, false)).toBe(
      true,
    );
  });

  it('refreshes when the kit hash changes', () => {
    expect(kitRequiresRefresh(stored, 'other', false)).toBe(true);
  });

  it('refreshes on a rework even if the stored kit hash still matches', () => {
    expect(kitRequiresRefresh(stored, stored.kitHash, true)).toBe(true);
  });

  it('always generates when nothing is stored', () => {
    expect(kitRequiresRefresh(null, stored.kitHash, false)).toBe(true);
  });
});

describe('parseMatchupGuide', () => {
  it('accepts a complete guide', () => {
    const parsed = parseMatchupGuide(validGuide, 'garen');
    expect(parsed?.oneThing).toContain('Darius');
    expect(parsed?.phases).toHaveLength(3);
    expect(parsed?.trades.good.steps).toHaveLength(4);
    expect(parsed?.spikes).toHaveLength(5);
  });

  it('rejects a missing phase or invented style', () => {
    expect(parseMatchupGuide({ ...validGuide, style: 'FULL SEND' }, 'garen')).toBeNull();
    expect(
      parseMatchupGuide(
        {
          ...validGuide,
          phases: validGuide.phases.slice(0, 2),
        },
        'garen',
      ),
    ).toBeNull();
  });

  it('rejects a guide written for the other seat', () => {
    expect(parseMatchupGuide({ ...validGuide, you_slug: 'darius' }, 'garen')).toBeNull();
  });

  it('rejects a kit dump with no play instructions', () => {
    expect(parseMatchupGuide({ ...validGuide, ability_notes: [] }, 'garen')).toBeNull();
  });

  it('rejects a guide with no fight windows', () => {
    expect(parseMatchupGuide({ ...validGuide, spikes: [] }, 'garen')).toBeNull();
  });

  it('keeps an over-long play line instead of discarding the guide', () => {
    const longWin = 'Leave before he stacks four and then walks you down the lane';
    expect(longWin.length).toBeGreaterThan(48);
    const parsed = parseMatchupGuide(
      {
        ...validGuide,
        ability_notes: validGuide.ability_notes.map((row, index) =>
          index === 0 ? { ...row, win: longWin } : row,
        ),
      },
      'garen',
    );
    expect(parsed?.abilityNotes[0]?.win).toHaveLength(48);
  });

  it('names the check that rejected the guide', () => {
    expect(explainMatchupGuideRejection({ ...validGuide, you_slug: 'darius' }, 'garen')).toContain(
      'you_slug',
    );
    expect(explainMatchupGuideRejection({ ...validGuide, ability_notes: [] }, 'garen')).toContain(
      'ability_notes',
    );
  });
});

describe('parseSpikes', () => {
  it('keeps the five fight beats in order', () => {
    expect(parseSpikes(validGuide.spikes)?.map((row) => row.at)).toEqual([
      'LVL 1',
      'LVL 3',
      'LVL 5',
      '1st ITEM',
      'LVL 11',
    ]);
  });
});

describe('parseAbilityNotes', () => {
  it('keeps cue, consequence, and the play', () => {
    const notes = parseAbilityNotes(validGuide.ability_notes);
    expect(notes).toHaveLength(4);
    expect(notes?.[0]).toMatchObject({
      own: false,
      k: 'Q',
      win: '~3s punish window',
    });
  });

  it('drops notes for keys that are not on the supplied kits', () => {
    expect(
      parseAbilityNotes(validGuide.ability_notes, { you: ['Q'], them: ['Q'] }),
    ).toBeNull();
  });
});

describe('MATCHUP_GUIDE_RULES', () => {
  it('keeps a non-empty numbered policy list', () => {
    expect(MATCHUP_GUIDE_RULES.length).toBeGreaterThan(0);
    expect(MATCHUP_GUIDE_RULES.every((rule) => rule.length > 10)).toBe(true);
  });
});

describe('hasMatchupGenerationSlot', () => {
  it('caps concurrent generations', () => {
    expect(hasMatchupGenerationSlot(0, 2)).toBe(true);
    expect(hasMatchupGenerationSlot(1, 2)).toBe(true);
    expect(hasMatchupGenerationSlot(2, 2)).toBe(false);
  });
});

describe('matchup spend limits', () => {
  it('clamps env limits and treats zero as a hard stop', () => {
    expect(parseMatchupLimit(undefined, 40, 500)).toBe(40);
    expect(parseMatchupLimit('12', 40, 500)).toBe(12);
    expect(parseMatchupLimit('9999', 40, 500)).toBe(500);
    expect(parseMatchupLimit('0', 40, 500)).toBe(0);
    expect(parseMatchupLimit('nope', 40, 500)).toBe(40);
  });

  it('can be switched off without removing the API key', () => {
    const previous = process.env.OPENAI_MATCHUP_GENERATION;
    process.env.OPENAI_MATCHUP_GENERATION = 'off';
    expect(matchupGenerationEnabled()).toBe(false);
    process.env.OPENAI_MATCHUP_GENERATION = 'on';
    expect(matchupGenerationEnabled()).toBe(true);
    if (previous == null) {
      delete process.env.OPENAI_MATCHUP_GENERATION;
    } else {
      process.env.OPENAI_MATCHUP_GENERATION = previous;
    }
  });
});

describe('matchPatchChampion', () => {
  it('matches a patch name to one of the two slugs', () => {
    expect(matchPatchChampion('Garen', ['garen', 'darius'])).toBe('garen');
    expect(matchPatchChampion('Miss Fortune', ['garen', 'miss-fortune'])).toBe('miss-fortune');
    expect(matchPatchChampion('Ahri', ['garen', 'darius'])).toBeNull();
  });
});
