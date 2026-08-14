import { describe, expect, it } from 'vitest';
import type { MatchupResponse } from './api-types';
import { buildMatchupCard, coachBriefFor, savedLaneVerdict } from './matchup-card';

const live: MatchupResponse = {
  you: {
    slug: 'garen',
    name: 'Garen',
    title: 'The Might of Demacia',
    roles: ['fighter'],
    imageUrl: null,
    winRate: '53.3%',
    pickRate: '8.1%',
  },
  them: {
    slug: 'darius',
    name: 'Darius',
    title: 'The Hand of Noxus',
    roles: ['fighter'],
    imageUrl: null,
    winRate: '52.6%',
    pickRate: '9.4%',
  },
  lane: 'Top',
  side: 'you',
  verdict: 'Garen favoured',
  difficulty: 'Easy',
  score: 4.5,
  confidence: 'Lane win rates this snapshot',
  sample: 'CN Diamond+ snapshot 2026-08-12',
  freshness: 'Lane rates from 2026-08-12. Not a head-to-head sample.',
  abilitiesYou: [
    { key: 'Q', name: 'Decisive Strike', description: 'Silences on the next attack.' },
  ],
  abilitiesThem: [{ key: 'Q', name: 'Decimate', description: 'Heals if the blade hits.' }],
};

describe('buildMatchupCard', () => {
  it('does not keep Garen vs Darius authored items or runes', () => {
    const card = buildMatchupCard(live, 'garen', 'darius', 'Top', []);
    expect(card.verdict).toBe('GAREN FAVOURED');
    expect(card.rule).toContain('not a head-to-head sample');
    expect(card.abilities).toEqual([
      { own: true, k: 'Q', n: 'Decisive Strike', note: 'Silences on the next attack.' },
      { own: false, k: 'Q', n: 'Decimate', note: 'Heals if the blade hits.' },
    ]);
    expect(card.authored).toBe(false);
    expect(card.modelled.gapLine).toContain('+0.7 pts in your favour');
    expect(card.quick.map((chip) => chip.k)).toEqual(['VERDICT', 'YOU', 'THEM']);
    expect(JSON.stringify(card)).not.toContain('Plated Steelcaps');
    expect(JSON.stringify(card)).not.toContain('Noxian Guillotine');
  });

  it('falls back without inventing a pairwise sample', () => {
    const card = buildMatchupCard(null, 'gwen', 'sett', 'Jungle', []);
    expect(card.sample).toContain('Pairwise');
    expect(card.you.name).toBe('Gwen');
    expect(card.them.name).toBe('Sett');
  });
});

describe('buildMatchupCard with a stored guide', () => {
  it('uses authored copy and keeps the computed lane verdict', () => {
    const card = buildMatchupCard(
      {
        ...live,
        guide: {
          oneThing: 'Do not let Darius extend the fight past two autos.',
          style: 'CAUTIOUS / SHORT TRADES',
          stylePos: 26,
          phases: [
            { n: 'EARLY', t: 'Levels 1–4', body: 'Concede the first two waves.' },
            { n: 'MID', t: 'Levels 5–10', body: 'Look for the ultimate window.' },
            { n: 'LATE', t: 'Levels 11+', body: 'Stop duelling him in the side lane.' },
          ],
          trades: {
            good: { steps: ['Missed Q', 'Silence', 'Two autos'], out: 'Reset the wave.' },
            bad: { steps: ['Stay in melee', 'Five stacks', 'Execute'], out: 'He takes the lane.' },
          },
          mistakes: ['Spending Courage on his Q.'],
          tags: ['Fighter'],
          abilityNotes: [
            {
              own: false,
              k: 'Q',
              when: 'If he misses the outer edge',
              then: 'No heal, weak trade',
              win: '~3s punish window',
              note: 'The blade edge is where his healing comes from.',
            },
            {
              own: true,
              k: 'Q',
              when: 'Hold silence for the pull',
              then: 'Not for a random auto',
              win: 'Cancels his engage',
              note: 'The silence is the only way you leave after he grabs you.',
            },
          ],
          spikes: [
            { at: 'LVL 1', who: 'them', label: 'Give the first wave. Do not fight.' },
            { at: 'LVL 3', who: 'even', label: 'Short trade only after he misses Decimate.' },
            { at: 'LVL 5', who: 'you', label: 'All-in once your ultimate is up and he is chipped.' },
            { at: '1st ITEM', who: 'even', label: 'Reset before the first item finishes. Do not linger.' },
            { at: 'LVL 11', who: 'them', label: 'Stop side-lane duelling. Group instead.' },
          ],
          patchVersion: '7.2c',
        },
      },
      'garen',
      'darius',
      'Top',
      [],
    );
    expect(card.authored).toBe(true);
    expect(card.rule).toContain('Do not let Darius extend');
    expect(card.verdict).toBe('GAREN FAVOURED');
    expect(card.freshness).toContain('7.2c');
    expect(card.quick.map((chip) => chip.k)).toContain('PLAYSTYLE');
    expect(card.abilities).toEqual([
      {
        own: false,
        k: 'Q',
        n: 'Decimate',
        when: 'If he misses the outer edge',
        then: 'No heal, weak trade',
        win: '~3s punish window',
        note: 'The blade edge is where his healing comes from.',
        authored: true,
        imageUrl: undefined,
      },
      {
        own: true,
        k: 'Q',
        n: 'Decisive Strike',
        when: 'Hold silence for the pull',
        then: 'Not for a random auto',
        win: 'Cancels his engage',
        note: 'The silence is the only way you leave after he grabs you.',
        authored: true,
        imageUrl: undefined,
      },
    ]);
    expect(card.spikes[0]).toEqual({
      at: 'LVL 1',
      who: 'them',
      label: 'Give the first wave. Do not fight.',
    });
    expect(JSON.stringify(card)).not.toContain('Plated Steelcaps');
    expect(JSON.stringify(card.abilities)).not.toContain('Silences on the next attack');
  });
});

describe('savedLaneVerdict', () => {
  it('uses live rates and does not invent a favourite without them', () => {
    expect(savedLaneVerdict('Garen', 'Darius', 54, 50)).toEqual({
      side: 'you',
      verdict: 'GAREN FAVOURED',
    });
    expect(savedLaneVerdict('Garen', 'Darius')).toEqual({
      side: 'even',
      verdict: 'NO LANE SNAPSHOT',
    });
  });
});

describe('coachBriefFor', () => {
  it('grounds the brief in lane rates, not a build', () => {
    const brief = coachBriefFor(buildMatchupCard(live, 'garen', 'darius', 'Top', []));
    expect(brief[0]?.t).toContain('not a head-to-head sample');
    expect(brief[1]?.t).toContain('Modelled read only');
    expect(brief[2]?.t).toContain('53.3%');
    expect(brief.map((line) => line.t).join(' ')).not.toContain('Steelcaps');
  });
});
