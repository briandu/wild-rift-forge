/**
 * Stub counter / matchup payloads for the first UI pass.
 * Scores and rates are design fixtures — not live ranked facts.
 */

export interface CounterPick {
  slug: string;
  name: string;
  score: number;
  winRate: string;
  tag: 'STRONG COUNTER' | 'GOOD COUNTER';
  why: string;
  imageUrl?: string | null;
}

export interface AlsoPick {
  slug: string;
  name: string;
  score: number;
  winRate: string;
}

export interface CounterStat {
  value: string;
  label: string;
}

export interface CounterPayload {
  stub: true;
  enemySlug: string;
  enemyName: string;
  lane: string;
  games: string;
  blurb: string;
  stats: CounterStat[];
  notes: string[];
  picks: CounterPick[];
  also: AlsoPick[];
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function pick(
  name: string,
  score: number,
  winRate: string,
  tag: CounterPick['tag'],
  why: string,
): CounterPick {
  return { slug: slugify(name), name, score, winRate, tag, why };
}

function also(name: string, score: number, winRate: string): AlsoPick {
  return { slug: slugify(name), name, score, winRate };
}

const MATCHUPS: Record<string, Omit<CounterPayload, 'stub' | 'enemySlug' | 'enemyName'>> = {
  sett: {
    lane: 'TOP LANE',
    games: '214,806',
    blurb: 'Punches through anything that stands still. Trade first, and his shield stays empty.',
    stats: [
      { value: '51.4%', label: 'WIN RATE' },
      { value: '18.9%', label: 'PICK RATE' },
      { value: '9.2%', label: 'BAN RATE' },
    ],
    notes: [
      'Grit only converts damage he has already taken. Hit first and the shield is worth nothing.',
      'His pull needs two targets. Stand away from the minion wave and half the kit disappears.',
      'After six he wants one all-in. Sustained damage beats his burst window.',
    ],
    picks: [
      pick('Volibear', 78, '56.2%', 'STRONG COUNTER', 'Wins extended trades outright and ignores the grit shield.'),
      pick('Renekton', 75, '55.4%', 'STRONG COUNTER', 'Owns levels 1 to 3 and stuns straight through the pull.'),
      pick('Gwen', 72, '54.0%', 'GOOD COUNTER', 'Her untargetable window blanks his ultimate entirely.'),
    ],
    also: [
      also('Malphite', 69, '53.1%'),
      also('Camille', 66, '52.4%'),
      also('Fiora', 64, '51.9%'),
      also('Jax', 61, '51.2%'),
    ],
  },
  ashe: {
    lane: 'DRAGON LANE',
    games: '68,204',
    blurb: 'Long-range poke with permanent slows. Punish her before six, or out-range her after.',
    stats: [
      { value: '51.8%', label: 'WIN RATE' },
      { value: '22.4%', label: 'PICK RATE' },
      { value: '6.1%', label: 'BAN RATE' },
    ],
    notes: [
      'No dash and no escape. Any engage that lands is usually fatal.',
      'Her slow is her only defence, so pressure her the moment it is on cooldown.',
      'She wants a long lane. Push the wave and force her under tower.',
    ],
    picks: [
      pick('Caitlyn', 79, '56.4%', 'STRONG COUNTER', 'Out-ranges her poke and denies the wave with traps.'),
      pick('Draven', 76, '55.1%', 'STRONG COUNTER', 'Wins every level 1 to 5 trade if the axes land.'),
      pick('Vayne', 71, '53.6%', 'GOOD COUNTER', 'Condemn breaks her arrow, and she scales past it.'),
    ],
    also: [
      also('Jinx', 68, '51.9%'),
      also('Camille', 64, '52.4%'),
      also('Irelia', 62, '50.4%'),
      also('Teemo', 58, '45.6%'),
    ],
  },
  volibear: {
    lane: 'TOP LANE',
    games: '96,412',
    blurb: 'A late-game bruiser with a tower-breaking ultimate. Beat him early or not at all.',
    stats: [
      { value: '56.2%', label: 'WIN RATE' },
      { value: '14.1%', label: 'PICK RATE' },
      { value: '11.4%', label: 'BAN RATE' },
    ],
    notes: [
      'Slow and immobile before level six. Poke him out of lane while you can.',
      'His ultimate disables one tower, so track it before diving under yours.',
      'Ranged pressure and percentage-health damage cut through his sustain.',
    ],
    picks: [
      pick('Gwen', 74, '54.0%', 'STRONG COUNTER', 'Percentage damage cuts through the health stacking.'),
      pick('Fiora', 71, '51.9%', 'GOOD COUNTER', 'Parries the bite and duels him down after level six.'),
      pick('Renekton', 68, '55.4%', 'GOOD COUNTER', 'Bullies him flat for the first six levels.'),
    ],
    also: [
      also('Teemo', 66, '45.6%'),
      also('Malphite', 62, '53.1%'),
      also('Camille', 60, '52.4%'),
      also('Jax', 57, '51.2%'),
    ],
  },
  gwen: {
    lane: 'TOP LANE',
    games: '72,338',
    blurb: 'Scales into an unkillable duelist. Her mist is a small circle, so fight outside it.',
    stats: [
      { value: '54.0%', label: 'WIN RATE' },
      { value: '11.8%', label: 'PICK RATE' },
      { value: '7.6%', label: 'BAN RATE' },
    ],
    notes: [
      'The mist has a hard edge. Step out of it and she loses her defences.',
      'Weak level 1 to 3 — most of her losses start there.',
      'Grievous wounds gut the healing she relies on in extended fights.',
    ],
    picks: [
      pick('Renekton', 76, '55.4%', 'STRONG COUNTER', 'Wins the early levels before the mist matters.'),
      pick('Sett', 70, '51.4%', 'GOOD COUNTER', 'The true damage punch beats her scaling trades.'),
      pick('Malphite', 67, '53.1%', 'GOOD COUNTER', 'Armour stacking flattens the on-hit damage.'),
    ],
    also: [
      also('Darius', 65, '52.6%'),
      also('Jax', 62, '51.2%'),
      also('Irelia', 59, '50.4%'),
      also('Garen', 56, '53.3%'),
    ],
  },
  renekton: {
    lane: 'TOP LANE',
    games: '118,540',
    blurb: 'Dominates the first ten minutes. Survive the early game and he falls off hard.',
    stats: [
      { value: '55.4%', label: 'WIN RATE' },
      { value: '16.2%', label: 'PICK RATE' },
      { value: '12.8%', label: 'BAN RATE' },
    ],
    notes: [
      'Empowered abilities need fury. Trade when the bar is empty.',
      'His pressure fades after twenty minutes — play for the mid game.',
      'Sustain and short cooldowns outlast his burst windows.',
    ],
    picks: [
      pick('Gwen', 73, '54.0%', 'STRONG COUNTER', 'Survives the early game and out-scales him completely.'),
      pick('Volibear', 70, '56.2%', 'GOOD COUNTER', 'Sustains through the fury windows and wins later.'),
      pick('Malphite', 68, '53.1%', 'GOOD COUNTER', 'Armour and passive shield blunt the early dives.'),
    ],
    also: [
      also('Camille', 64, '52.4%'),
      also('Fiora', 62, '51.9%'),
      also('Sett', 60, '51.4%'),
      also('Nasus', 54, '44.1%'),
    ],
  },
};

function fallback(enemyName: string): Omit<CounterPayload, 'stub' | 'enemySlug' | 'enemyName'> {
  return {
    lane: 'TOP LANE',
    games: '41,120',
    blurb: `Early matchup data for ${enemyName} is still thin. These are the safest picks into the lane.`,
    stats: [
      { value: '50.6%', label: 'WIN RATE' },
      { value: '6.4%', label: 'PICK RATE' },
      { value: '2.1%', label: 'BAN RATE' },
    ],
    notes: [
      'Sample size is small this patch, so treat the scores as directional.',
      'Safe, self-sufficient picks are the reliable answer into an unknown lane.',
      'Check back after the next patch for a fuller read on the matchup.',
    ],
    picks: [
      pick('Malphite', 71, '53.1%', 'STRONG COUNTER', 'Armour scaling flattens the damage curve of the matchup.'),
      pick('Volibear', 68, '56.2%', 'GOOD COUNTER', 'Wins extended trades and sustains through the lane.'),
      pick('Gwen', 65, '54.0%', 'GOOD COUNTER', 'Out-scales the matchup and survives the early pressure.'),
    ],
    also: [
      also('Camille', 61, '52.4%'),
      also('Fiora', 59, '51.9%'),
      also('Jax', 57, '51.2%'),
      also('Garen', 55, '53.3%'),
    ],
  };
}

export function getStubCounters(slug: string, enemyName: string): CounterPayload {
  const key = slug.toLowerCase();
  const base = MATCHUPS[key] ?? fallback(enemyName);
  return {
    stub: true,
    enemySlug: slug,
    enemyName,
    ...base,
  };
}
