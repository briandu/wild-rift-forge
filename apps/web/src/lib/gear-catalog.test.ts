import { describe, expect, it } from 'vitest';
import { GEAR_CATALOG, gearFor, monogram } from './gear-catalog';

describe('gearFor', () => {
  it('filters the handoff catalog by kind and class', () => {
    expect(gearFor('Items').length).toBe(GEAR_CATALOG.filter((row) => row.kind === 'Items').length);
    expect(gearFor('Items', 'Boots').every((row) => row.cls === 'Boots')).toBe(true);
    expect(gearFor('Runes', 'Keystone').map((row) => row.n)).toEqual(['Conqueror']);
  });
});

describe('monogram', () => {
  it('uses the first letters of a two-word item name', () => {
    expect(monogram('Trinity Force')).toBe('TF');
    expect(monogram("Sterak's Gage")).toBe('SG');
  });
});
