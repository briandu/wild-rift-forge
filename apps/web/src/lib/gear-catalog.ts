export type GearKind = 'Items' | 'Runes';

export type GearEntry = {
  n: string;
  slug: string;
  kind: GearKind;
  cls: string;
  cost?: string;
  stats: string[];
  passive: string;
  by: string[];
  icon: string;
};

export const ITEM_CLASSES = ['All', 'Fighter', 'Tank', 'Boots'] as const;
export const RUNE_CLASSES = ['All', 'Keystone', 'Resolve'] as const;

export const GEAR_CATALOG: GearEntry[] = [
  {
    n: 'Trinity Force',
    slug: 'trinity-force',
    kind: 'Items',
    cls: 'Fighter',
    cost: '3333',
    stats: ['+30 Attack damage', '+30% Attack speed', '+300 Health', '+20 Ability haste'],
    passive:
      'Spellblade — after using an ability, the next attack deals bonus physical damage and grants movement speed.',
    by: ['garen', 'irelia', 'jax', 'camille'],
    icon: '/gear/item-trinity-force.png',
  },
  {
    n: 'Black Cleaver',
    slug: 'black-cleaver',
    kind: 'Items',
    cls: 'Fighter',
    cost: '3000',
    stats: ['+45 Attack damage', '+300 Health', '+25 Ability haste'],
    passive:
      'Carve — damaging an enemy champion shreds their armour. Stacks up to six times and applies to your whole team.',
    by: ['darius', 'garen', 'renekton', 'sett'],
    icon: '/gear/item-black-cleaver.png',
  },
  {
    n: "Sterak's Gage",
    slug: 'steraks-gage',
    kind: 'Items',
    cls: 'Fighter',
    cost: '2900',
    stats: ['+400 Health', '+20% Base attack damage', '+15 Tenacity'],
    passive: 'Lifeline — dropping below 30% health grants a large shield that decays over eight seconds.',
    by: ['garen', 'sett', 'darius', 'jax'],
    icon: '/gear/item-steraks-gage.png',
  },
  {
    n: "Death's Dance",
    slug: 'deaths-dance',
    kind: 'Items',
    cls: 'Fighter',
    cost: '2900',
    stats: ['+55 Attack damage', '+40 Armour', '+15 Ability haste'],
    passive:
      'Defy — a share of incoming damage is dealt over three seconds instead of instantly. Takedowns clear it and heal you.',
    by: ['renekton', 'camille', 'fiora', 'irelia'],
    icon: '/gear/item-deaths-dance.png',
  },
  {
    n: "Randuin's Omen",
    slug: 'randuins-omen',
    kind: 'Items',
    cls: 'Tank',
    cost: '2700',
    stats: ['+700 Health', '+60 Armour'],
    passive: 'Cold Steel — attackers are slowed. Active slows and reduces the damage of nearby enemies.',
    by: ['malphite', 'rammus', 'leona', 'braum'],
    icon: '/gear/item-randuins-omen.png',
  },
  {
    n: 'Force of Nature',
    slug: 'force-of-nature',
    kind: 'Items',
    cls: 'Tank',
    cost: '2800',
    stats: ['+400 Health', '+60 Magic resistance', '+5% Movement speed'],
    passive:
      'Absorb — taking magic damage stacks a shield. At full stacks you gain movement speed and heavy magic reduction.',
    by: ['malphite', 'sett', 'volibear', 'garen'],
    icon: '/gear/item-force-of-nature.png',
  },
  {
    n: 'Spirit Visage',
    slug: 'spirit-visage',
    kind: 'Items',
    cls: 'Tank',
    cost: '2700',
    stats: ['+450 Health', '+50 Magic resistance', '+20 Ability haste'],
    passive: 'Boundless Vitality — increases all healing, shielding and regeneration you receive by a quarter.',
    by: ['volibear', 'sett', 'garen', 'nasus'],
    icon: '/gear/item-spirit-visage.png',
  },
  {
    n: 'Plated Steelcaps',
    slug: 'plated-steelcaps',
    kind: 'Items',
    cls: 'Boots',
    cost: '1100',
    stats: ['+45 Movement speed', '+20 Armour'],
    passive: 'Plating — reduces the damage of incoming basic attacks by a flat share.',
    by: ['garen', 'malphite', 'renekton', 'fiora'],
    icon: '/gear/item-plated-steelcaps.png',
  },
  {
    n: "Mercury's Treads",
    slug: 'mercurys-treads',
    kind: 'Items',
    cls: 'Boots',
    cost: '1100',
    stats: ['+45 Movement speed', '+25 Magic resistance', '+30 Tenacity'],
    passive: 'Steady — shortens the duration of stuns, slows, taunts and fears.',
    by: ['sett', 'volibear', 'camille', 'jax'],
    icon: '/gear/item-mercurys-treads.png',
  },
  {
    n: 'Ionian Boots',
    slug: 'ionian-boots',
    kind: 'Items',
    cls: 'Boots',
    cost: '1000',
    stats: ['+45 Movement speed', '+15 Ability haste'],
    passive: 'Insight — reduces the cooldown of your summoner spells.',
    by: ['ahri', 'irelia', 'yasuo', 'gwen'],
    icon: '/gear/item-ionian-boots.png',
  },
  {
    n: 'Conqueror',
    slug: 'conqueror',
    kind: 'Runes',
    cls: 'Keystone',
    stats: ['Stacks on damage', 'Heals at full stacks'],
    passive:
      'Damaging an enemy champion grants a stack of adaptive force. At full stacks, a share of your damage heals you.',
    by: ['garen', 'darius', 'renekton', 'sett'],
    icon: '/gear/rune-conqueror.png',
  },
  {
    n: 'Bone Plating',
    slug: 'bone-plating',
    kind: 'Runes',
    cls: 'Resolve',
    stats: ['Reduces the next three hits', '15 second cooldown'],
    passive: 'After an enemy champion damages you, the next three sources of damage from them are reduced.',
    by: ['garen', 'malphite', 'nasus', 'volibear'],
    icon: '/gear/rune-bone-plating.png',
  },
  {
    n: 'Hunter–Titan',
    slug: 'hunter-titan',
    kind: 'Runes',
    cls: 'Resolve',
    stats: ['+Health per takedown', '+Tenacity'],
    passive: 'Grants bonus health, and tenacity that grows with each unique champion takedown.',
    by: ['sett', 'leona', 'rammus', 'braum'],
    icon: '/gear/rune-hunter-titan.png',
  },
];

export function gearFor(kind: GearKind, cls = 'All'): GearEntry[] {
  return GEAR_CATALOG.filter((row) => row.kind === kind && (cls === 'All' || row.cls === cls));
}

export function monogram(name: string): string {
  return name
    .split(/[\s–-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
