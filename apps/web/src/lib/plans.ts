export const PLAN_IDS = ['Free', 'Pro', 'Squad'] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type Billing = 'Monthly' | 'Annual';

export const PLANS: Array<{
  id: PlanId;
  price: Record<Billing, string>;
  tag?: string;
  blurb: string;
  feats: string[];
}> = [
  {
    id: 'Free',
    price: { Monthly: '0', Annual: '0' },
    blurb: 'Everything the site does today, for as long as you want it.',
    feats: [
      'Every counter and matchup page',
      'Tier list and patch notes',
      'Three saved matchups',
    ],
  },
  {
    id: 'Pro',
    price: { Monthly: '6', Annual: '4' },
    tag: 'MOST POPULAR',
    blurb: 'Your own games become the data. Built for one player climbing solo.',
    feats: [
      'Everything in Free',
      'Draft assistant',
      'Champion select overlay',
      'Your match history as the source',
      'Unlimited saved matchups',
      'Coaching briefs on every matchup',
      'Patch alerts for your pool',
    ],
  },
  {
    id: 'Squad',
    price: { Monthly: '20', Annual: '15' },
    blurb: 'One bill for a five-stack, with shared drafts and scrim notes.',
    feats: [
      'Everything in Pro, five seats',
      'Shared draft boards',
      'Scrim notes and pick history',
      'Team composition reports',
      'Priority data refresh',
    ],
  },
];

export const PLAN_MATRIX: Array<{
  k: string;
  f: boolean | string;
  p: boolean | string;
  s: boolean | string;
}> = [
  { k: 'Counters, tier list and patch notes', f: true, p: true, s: true },
  { k: 'Draft assistant', f: false, p: true, s: true },
  { k: 'Saved matchups', f: '3', p: 'Unlimited', s: 'Unlimited' },
  { k: 'Champion select overlay', f: false, p: true, s: true },
  { k: 'Your match history as the data source', f: false, p: true, s: true },
  { k: 'Coaching briefs', f: false, p: true, s: true },
  { k: 'Patch alerts for your pool', f: false, p: true, s: true },
  { k: 'Shared draft boards', f: false, p: false, s: true },
  { k: 'Scrim notes and pick history', f: false, p: false, s: true },
  { k: 'Seats', f: '1', p: '1', s: '5' },
];
