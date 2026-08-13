/** Design-fixture data from Claude handoff — not live ranked facts. */

export type ChampMeta = {
  name: string;
  slug: string;
  role: string;
  wr: string;
  lanes: string[];
  bg: string;
};

const g = (a: string, b: string) => `linear-gradient(150deg,${a},${b})`;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const CHAMP_META: Record<string, ChampMeta> = {
  Sett: { name: 'Sett', slug: 'sett', role: 'Top · Fighter', wr: '51.4%', lanes: ['Top', 'Jungle'], bg: g('#E8734A', '#B4341F') },
  Volibear: { name: 'Volibear', slug: 'volibear', role: 'Top · Fighter', wr: '56.2%', lanes: ['Top', 'Jungle'], bg: g('#5BC0F0', '#2A6FA8') },
  Gwen: { name: 'Gwen', slug: 'gwen', role: 'Top · Fighter', wr: '54.0%', lanes: ['Top', 'Jungle'], bg: g('#8FE0D0', '#2E8F84') },
  Renekton: { name: 'Renekton', slug: 'renekton', role: 'Top · Fighter', wr: '55.4%', lanes: ['Top'], bg: g('#E39A55', '#9A5220') },
  Ashe: { name: 'Ashe', slug: 'ashe', role: 'ADC · Marksman', wr: '51.8%', lanes: ['Dragon'], bg: g('#6FA8DC', '#2E5F94') },
  Ahri: { name: 'Ahri', slug: 'ahri', role: 'Mid · Mage', wr: '52.0%', lanes: ['Mid'], bg: g('#F07AB5', '#A8317A') },
  Yasuo: { name: 'Yasuo', slug: 'yasuo', role: 'Mid · Fighter', wr: '49.1%', lanes: ['Mid', 'Top'], bg: g('#66C6E8', '#2E6E9E') },
  Garen: { name: 'Garen', slug: 'garen', role: 'Top · Fighter', wr: '53.3%', lanes: ['Top'], bg: g('#E5C067', '#9A7526') },
  Jinx: { name: 'Jinx', slug: 'jinx', role: 'ADC · Marksman', wr: '51.9%', lanes: ['Dragon'], bg: g('#9B84FF', '#4B34B8') },
  Darius: { name: 'Darius', slug: 'darius', role: 'Top · Fighter', wr: '52.6%', lanes: ['Top', 'Jungle'], bg: g('#D4604A', '#8A2A22') },
  Camille: { name: 'Camille', slug: 'camille', role: 'Top · Fighter', wr: '52.4%', lanes: ['Top', 'Jungle'], bg: g('#8E9BE6', '#3E4A9E') },
  Fiora: { name: 'Fiora', slug: 'fiora', role: 'Top · Fighter', wr: '51.9%', lanes: ['Top'], bg: g('#E894AE', '#9E3E62') },
  Malphite: { name: 'Malphite', slug: 'malphite', role: 'Top · Tank', wr: '53.1%', lanes: ['Top', 'Support'], bg: g('#93A2B4', '#4A5666') },
  Jax: { name: 'Jax', slug: 'jax', role: 'Top · Fighter', wr: '51.2%', lanes: ['Top', 'Jungle'], bg: g('#B9C46A', '#6B7530') },
  Irelia: { name: 'Irelia', slug: 'irelia', role: 'Top · Fighter', wr: '50.4%', lanes: ['Top', 'Mid'], bg: g('#A6C7E8', '#4B6E96') },
  Caitlyn: { name: 'Caitlyn', slug: 'caitlyn', role: 'ADC · Marksman', wr: '56.4%', lanes: ['Dragon'], bg: g('#E2C15F', '#94722A') },
  Draven: { name: 'Draven', slug: 'draven', role: 'ADC · Marksman', wr: '55.1%', lanes: ['Dragon'], bg: g('#D96A5C', '#8E2E2C') },
  Vayne: { name: 'Vayne', slug: 'vayne', role: 'ADC · Marksman', wr: '53.6%', lanes: ['Dragon'], bg: g('#9C8CF0', '#4E3AA8') },
  Nasus: { name: 'Nasus', slug: 'nasus', role: 'Top · Fighter', wr: '44.1%', lanes: ['Top', 'Jungle'], bg: g('#E0B370', '#96682C') },
  Teemo: { name: 'Teemo', slug: 'teemo', role: 'Top · Marksman', wr: '45.6%', lanes: ['Top'], bg: g('#8FD48F', '#3E8446') },
  Leona: { name: 'Leona', slug: 'leona', role: 'Support · Tank', wr: '52.7%', lanes: ['Support'], bg: g('#E8C070', '#9A6A28') },
  Braum: { name: 'Braum', slug: 'braum', role: 'Support · Tank', wr: '51.1%', lanes: ['Support'], bg: g('#7FB8D8', '#3A6E94') },
  Rammus: { name: 'Rammus', slug: 'rammus', role: 'Jungle · Tank', wr: '50.8%', lanes: ['Jungle'], bg: g('#C4A86A', '#7A5E28') },
};

export function metaFor(name: string): ChampMeta {
  return (
    CHAMP_META[name] ?? {
      name,
      slug: slugify(name),
      role: 'Champion',
      wr: '50.0%',
      lanes: ['Top'],
      bg: g('#6E6A8C', '#3E3A54'),
    }
  );
}

export const MATCHUP_STUB = {
  you: 'Garen',
  them: 'Darius',
  lane: 'BARON LANE',
  verdict: 'DARIUS FAVOURED',
  side: 'them' as const,
  difficulty: 'Hard',
  score: 7.5,
  confidence: 'High confidence',
  sample: '38,410 games this patch',
  freshness: 'Matchup updated after the recent Darius changes',
  style: 'CAUTIOUS / SHORT TRADES',
  stylePos: 26,
  quick: [
    { k: 'VERDICT', v: 'Darius favoured', c: '#E58B7B' },
    { k: 'PLAYSTYLE', v: 'Short trades', c: '#F0A87B' },
    { k: 'AVOID', v: 'Extended fights', c: '#E58B7B' },
    { k: 'PUNISH', v: 'Missed Darius Q', c: '#8FEDB8' },
    { k: 'BUILD FIRST', v: 'Plated Steelcaps', c: '#9FCBE4' },
  ],
  rule: 'Do not let Darius extend the fight. Every second in melee range is a stack in his favour.',
  phases: [
    {
      n: 'EARLY',
      t: 'Levels 1–4',
      c: '#E58B7B',
      body: 'Concede the first two waves rather than contest them. Trade only when his Q is down, and never past two auto-attacks. Bone Plating carries you through his combo.',
    },
    {
      n: 'MID',
      t: 'Levels 5–10',
      c: '#F0A87B',
      body: 'Your ultimate creates real kill pressure once he is below half. Look for the window when he pushes without vision, or when he leaves lane and returns on low health.',
    },
    {
      n: 'LATE',
      t: 'Levels 11+',
      c: '#8FEDB8',
      body: 'Stop duelling him. Your job becomes flanking their carries and cutting the back line. Let a tank absorb his ultimate and take the fight elsewhere.',
    },
  ],
  good: {
    title: 'GOOD TRADE',
    steps: [
      'Darius misses Q',
      'Garen closes with Q, silence lands',
      'Two auto-attacks',
      'Walk out before stack three',
    ],
    out: 'You win the exchange and reset the wave.',
  },
  bad: {
    title: 'BAD TRADE',
    steps: [
      'Garen holds melee range',
      'Darius keeps auto-attacking',
      'Hemorrhage reaches five stacks',
      'Noxian Guillotine executes',
    ],
    out: 'He wins the trade outright and gains lane control.',
  },
  interactions: [
    {
      own: false,
      k: 'Q',
      n: 'Decimate',
      when: 'If he misses the outer edge',
      then: 'No heal, weak trade',
      win: '~3s punish window',
      note: 'The blade edge is where his healing comes from. Standing chest-to-chest denies it entirely.',
    },
    {
      own: false,
      k: 'E',
      n: 'Apprehend',
      when: 'If the pull whiffs',
      then: '9s cooldown, no engage',
      win: 'Free trade window',
      note: 'Stay on the far side of the wave. Without the pull he cannot start a fight you have not agreed to.',
    },
    {
      own: false,
      k: 'R',
      n: 'Noxian Guillotine',
      when: 'At five Hemorrhage stacks',
      then: 'Execute threshold rises sharply',
      win: 'Leave before stack four',
      note: 'Track your own health against his stacks, not against his health bar.',
    },
    {
      own: true,
      k: 'W',
      n: 'Courage',
      when: 'Hold it for his ultimate',
      then: 'Not for his Q',
      win: 'Survives the execute',
      note: 'Spending it early is the single most common way this matchup is lost.',
    },
  ],
  spikes: [
    { at: 'LVL 1', who: 'them' as const, label: 'Darius favoured' },
    { at: 'LVL 3', who: 'even' as const, label: 'Safer for Garen' },
    { at: 'LVL 5', who: 'you' as const, label: 'Ultimate kill pressure' },
    { at: '1st ITEM', who: 'even' as const, label: 'Swings on build' },
    { at: 'LVL 11', who: 'them' as const, label: 'He out-duels again' },
  ],
  mistakes: [
    'Spending Courage on his Q instead of saving it for the execute.',
    'Contesting the first wave and giving him a level-two all-in.',
    'Duelling him in the side lane at full build instead of grouping.',
  ],
  tags: ['2 Tanks', 'High crowd control', 'High armour', 'Mixed damage'],
  team: ['Darius', 'Rammus', 'Leona', 'Ahri', 'Jinx'],
  items: [
    {
      n: 'Plated Steelcaps',
      kind: 'MATCHUP',
      c: '#F0A87B',
      short: 'High value into repeated physical trades.',
      detail:
        'Darius deals almost all of his lane damage through auto-attacks and Crippling Strike. Flat physical reduction is worth more here than movement speed or tenacity.',
    },
    {
      n: "Black Cleaver",
      kind: 'COMPOSITION',
      c: '#9FCBE4',
      short: 'Their front line stacks armour.',
      detail:
        'Priority raised because Darius and Rammus both build armour. The shred applies to your whole team, not just your own damage.',
    },
    {
      n: "Sterak's Gage",
      kind: 'CORE',
      c: '#8FEDB8',
      short: 'Survives the execute threshold.',
      detail:
        'The shield triggers below 30% health, which is exactly the window Noxian Guillotine is looking for.',
    },
    {
      n: "Mercury's Treads",
      kind: 'SITUATIONAL',
      c: '#8B87A8',
      short: 'Only if Leona and Rammus are the bigger threat.',
      detail:
        'Swap off Steelcaps once teamfights matter more than the lane, or if Ahri is landing charms consistently.',
    },
  ],
  runes: [
    {
      n: 'Conqueror',
      kind: 'KEYSTONE',
      c: '#8FEDB8',
      short: 'Ramps in the short trades you want.',
      detail:
        'Stacks quickly through Q and two autos, which fits a short-trade pattern rather than a drawn-out fight.',
    },
    {
      n: 'Bone Plating',
      kind: 'MATCHUP',
      c: '#F0A87B',
      short: 'Blunts his full combo.',
      detail:
        'His damage arrives as a burst of three hits. Bone Plating removes a meaningful share of exactly that pattern.',
    },
    {
      n: 'Hunter–Titan',
      kind: 'COMPOSITION',
      c: '#9FCBE4',
      short: 'Their team has four reliable stuns.',
      detail:
        'Tenacity is recommended because Leona, Rammus, Ahri and Darius all bring hard crowd control.',
    },
  ],
};

export type PatchChange = {
  name: string;
  kind: 'BUFF' | 'NERF' | 'ADJUST';
  d: number;
  wr: string;
  lines: Array<{ k: string; t: string }>;
};

export const PATCH_CHANGES: PatchChange[] = [
  {
    name: 'Sett',
    kind: 'NERF',
    d: -1.8,
    wr: '51.4%',
    lines: [
      { k: 'P', t: 'Grit decay increased by 20%. The shield now falls off before a second trade.' },
      { k: 'Base', t: 'Health regen 7.5 → 6.0 per 5 seconds.' },
    ],
  },
  {
    name: 'Gwen',
    kind: 'BUFF',
    d: 2.1,
    wr: '54.0%',
    lines: [
      { k: 'W', t: 'Mist duration 5s → 5.5s, and the edge is now easier to hold.' },
      { k: 'Q', t: 'Damage per snip 8 → 10 at rank 1.' },
    ],
  },
  {
    name: 'Volibear',
    kind: 'ADJUST',
    d: 1.2,
    wr: '56.2%',
    lines: [
      { k: 'R', t: 'Tower disable duration 8s → 6s.' },
      { k: 'Q', t: 'Base damage up 15 at all ranks, cooldown up 1s early.' },
    ],
  },
  {
    name: 'Renekton',
    kind: 'NERF',
    d: -0.9,
    wr: '55.4%',
    lines: [
      { k: 'P', t: 'Fury generated on-hit 5 → 4.' },
      { k: 'E', t: 'Second cast damage ratio 1.2 → 1.05 bonus attack damage.' },
    ],
  },
  {
    name: 'Malphite',
    kind: 'BUFF',
    d: 1.4,
    wr: '53.1%',
    lines: [
      { k: 'Q', t: 'Armour ratio added: 15% bonus armour as damage.' },
      { k: 'Base', t: 'Armour growth 4.2 → 4.7.' },
    ],
  },
  {
    name: 'Ashe',
    kind: 'ADJUST',
    d: 0.3,
    wr: '51.8%',
    lines: [
      { k: 'W', t: 'Cone width reduced 10%, slow duration up 0.5s.' },
      { k: 'E', t: 'Hawkshot recharge 60s → 50s.' },
    ],
  },
  {
    name: 'Camille',
    kind: 'NERF',
    d: -1.1,
    wr: '52.4%',
    lines: [{ k: 'P', t: 'Shield decays 25% faster out of combat.' }],
  },
  {
    name: 'Nasus',
    kind: 'BUFF',
    d: 0.8,
    wr: '44.1%',
    lines: [
      { k: 'W', t: 'Wither slow 35% → 40% at rank 1.' },
      { k: 'Base', t: 'Attack speed growth 3.4% → 3.8%.' },
    ],
  },
];

export const PATCH_ITEMS = [
  'Sunfire Aegis burn now scales with bonus health instead of total health.',
  'Black Cleaver stacks decay in 4s rather than 6s.',
  "Serpent's Fang shield reduction 50% → 40% against shields under 300.",
];

export const TIER_DEFS = [
  {
    letter: 'S',
    label: 'FIRST PICK',
    min: 55,
    c: '#8FEDB8',
    bd: 'rgba(123,224,168,.34)',
    rowbg: 'rgba(123,224,168,.05)',
    badgebg: 'rgba(123,224,168,.09)',
  },
  {
    letter: 'A',
    label: 'STRONG',
    min: 52,
    c: '#F0A87B',
    bd: 'rgba(240,168,123,.3)',
    rowbg: 'rgba(240,168,123,.04)',
    badgebg: 'rgba(240,168,123,.08)',
  },
  {
    letter: 'B',
    label: 'PLAYABLE',
    min: 49,
    c: '#9FCBE4',
    bd: 'rgba(255,255,255,.1)',
    rowbg: 'rgba(255,255,255,.025)',
    badgebg: 'rgba(255,255,255,.05)',
  },
  {
    letter: 'C',
    label: 'STRUGGLING',
    min: -99,
    c: '#8B87A8',
    bd: 'rgba(255,255,255,.08)',
    rowbg: 'rgba(255,255,255,.015)',
    badgebg: 'rgba(255,255,255,.035)',
  },
] as const;

export function coachBriefFor(mu = MATCHUP_STUB) {
  const win = mu.spikes.find((s) => s.who === 'you') ?? mu.spikes[mu.spikes.length - 1];
  const windowLine = win
    ? `${win.at} is your first real window: ${win.label}`
    : 'Wait for your first item before looking for a fight.';
  return [
    { n: '1', t: mu.rule },
    {
      n: '2',
      t: `Play ${mu.style.toLowerCase().replace(' / ', ' with ')} until your first item. ${windowLine}`,
    },
    { n: '3', t: `Build ${mu.items[0]!.n} first for this lane. ${mu.items[0]!.short}` },
    {
      n: '4',
      t: `Their comp is ${mu.tags.join(', ').toLowerCase()}, so tenacity and armour buy you more than raw damage does.`,
    },
  ];
}

export const ACCOUNT_STUB = {
  riotId: 'Kaelan#NA1',
  rankLine: 'Emerald II · 42 LP',
  rank: 'Emerald II',
  lp: '42 / 100 LP',
  lpBar: 42,
  nextRank: '58 LP to Emerald I. Last ten games: 6 wins.',
  passAge: 'three months ago',
  stats: [
    { v: 'Emerald II', k: 'RANK', c: '#8FEDB8' },
    { v: '53.4%', k: 'WIN RATE', c: '#DEDCEE' },
    { v: '218', k: 'RANKED GAMES', c: '#DEDCEE' },
    { v: 'Top', k: 'MAIN LANE', c: '#DEDCEE' },
  ],
  pool: ['Garen', 'Volibear', 'Renekton', 'Gwen'],
  saved: [
    { you: 'Garen', them: 'Darius', verdict: 'DARIUS FAVOURED', side: 'them' as const, lane: 'Top' },
    { you: 'Gwen', them: 'Sett', verdict: 'GWEN FAVOURED', side: 'you' as const, lane: 'Top' },
    { you: 'Volibear', them: 'Renekton', verdict: 'EVEN MATCHUP', side: 'even' as const, lane: 'Jungle' },
  ],
  mostPlayed: [
    { name: 'Garen', games: 64, lane: 'Top' },
    { name: 'Volibear', games: 41, lane: 'Jungle' },
    { name: 'Renekton', games: 27, lane: 'Top' },
  ],
  suggestions: ['Malphite', 'Camille', 'Fiora', 'Jax', 'Sett', 'Nasus', 'Irelia', 'Ahri'],
};

export const ACCOUNT_MENU = [
  { href: '/me', label: 'Account' },
  { href: '/me?tab=pool', label: 'Champion pool', meta: String(ACCOUNT_STUB.pool.length) },
  { href: '/me?tab=saved', label: 'Saved matchups', meta: String(ACCOUNT_STUB.saved.length) },
  { href: '/me?tab=notifications', label: 'Notifications' },
  { href: '/me?tab=plan', label: 'Plan', meta: 'Beta' },
] as const;
