/** Visual tokens for S/A/B/C rows. Letters themselves come from live placements. */
export const TIER_DEFS = [
  {
    letter: 'S',
    label: 'FIRST PICK',
    c: '#8FEDB8',
    bd: 'rgba(123,224,168,.34)',
    rowbg: 'rgba(123,224,168,.05)',
    badgebg: 'rgba(123,224,168,.09)',
  },
  {
    letter: 'A',
    label: 'STRONG',
    c: '#F0A87B',
    bd: 'rgba(240,168,123,.3)',
    rowbg: 'rgba(240,168,123,.04)',
    badgebg: 'rgba(240,168,123,.08)',
  },
  {
    letter: 'B',
    label: 'PLAYABLE',
    c: '#9FCBE4',
    bd: 'rgba(255,255,255,.1)',
    rowbg: 'rgba(255,255,255,.025)',
    badgebg: 'rgba(255,255,255,.05)',
  },
  {
    letter: 'C',
    label: 'STRUGGLING',
    c: '#8B87A8',
    bd: 'rgba(255,255,255,.08)',
    rowbg: 'rgba(255,255,255,.015)',
    badgebg: 'rgba(255,255,255,.035)',
  },
] as const;
