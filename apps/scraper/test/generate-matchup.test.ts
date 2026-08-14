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
  parseMatchupGuide,
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
