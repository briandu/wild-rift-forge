import { describe, expect, it } from 'vitest';
import { patternBitmap, solidBitmap } from './fixtures';
import { colorSignature, dhash } from './hash';
import { matchTile, type IconReference } from './match';

function reference(slug: string, seed: number, variant?: IconReference['variant']): IconReference {
  const bitmap = patternBitmap(64, 64, seed);
  return { slug, hash: dhash(bitmap), color: colorSignature(bitmap), variant };
}

const references: IconReference[] = [
  reference('garen', 1),
  reference('darius', 2),
  reference('ahri', 3),
  reference('gwen', 4),
  reference('sett', 5),
];

describe('matchTile', () => {
  it('identifies an exact tile with high confidence', () => {
    const tile = patternBitmap(64, 64, 3);
    const result = matchTile(dhash(tile), colorSignature(tile), references);
    expect(result.best?.slug).toBe('ahri');
    expect(result.best?.distance).toBe(0);
    expect(result.best?.confidence).toBeGreaterThan(0.9);
    expect(result.accepted).toBe(true);
  });

  it('still identifies a tile captured at a smaller size', () => {
    const tile = patternBitmap(38, 38, 4);
    const result = matchTile(dhash(tile), colorSignature(tile), references);
    expect(result.best?.slug).toBe('gwen');
    expect(result.accepted).toBe(true);
  });

  it('rejects an empty slot instead of forcing it onto a champion', () => {
    const empty = solidBitmap(40, 40, 18, 18, 22);
    const result = matchTile(dhash(empty), colorSignature(empty), references);
    expect(result.accepted).toBe(false);
  });

  it('rejects unrelated artwork', () => {
    const unknown = patternBitmap(64, 64, 999);
    const result = matchTile(dhash(unknown), colorSignature(unknown), references);
    expect(result.accepted).toBe(false);
  });

  it('returns a candidate even when it rejects the match, for the correction UI', () => {
    const unknown = patternBitmap(64, 64, 999);
    const result = matchTile(dhash(unknown), colorSignature(unknown), references);
    expect(result.best?.slug).toBeTruthy();
    expect(result.accepted).toBe(false);
  });

  it('reports lower confidence when two champions look alike', () => {
    const tile = patternBitmap(64, 64, 3);
    const ambiguous = [...references, reference('ahri-twin', 3)];
    const clean = matchTile(dhash(tile), colorSignature(tile), references);
    const muddy = matchTile(dhash(tile), colorSignature(tile), ambiguous);
    expect(muddy.best?.confidence).toBeLessThan(clean.best?.confidence ?? 1);
  });

  it('prefers a confirmed capture when two variants tie', () => {
    const tile = patternBitmap(64, 64, 7);
    const result = matchTile(dhash(tile), colorSignature(tile), [
      reference('from-art', 7, 'thumb'),
      reference('from-capture', 7, 'captured'),
    ]);
    expect(result.best?.slug).toBe('from-capture');
    expect(result.best?.variant).toBe('captured');
  });

  it('honours the allow list so an already-identified champion is skipped', () => {
    const tile = patternBitmap(64, 64, 3);
    const result = matchTile(dhash(tile), colorSignature(tile), references, {
      allow: new Set(['garen', 'darius']),
    });
    expect(result.best?.slug).not.toBe('ahri');
    expect(['garen', 'darius']).toContain(result.best?.slug);
  });

  it('handles an empty reference library and malformed hashes', () => {
    const tile = patternBitmap(32, 32, 1);
    expect(matchTile(dhash(tile), undefined, []).accepted).toBe(false);
    expect(matchTile('bogus', undefined, references).best).toBeNull();
  });

  it('respects a raised acceptance threshold', () => {
    // A downscaled capture still matches, but not perfectly, so a strict threshold
    // turns it into a slot the user is asked to confirm rather than a silent guess.
    const tile = patternBitmap(38, 38, 2);
    const lenient = matchTile(dhash(tile), colorSignature(tile), references);
    const strict = matchTile(dhash(tile), colorSignature(tile), references, {
      acceptConfidence: 0.99,
    });
    expect(lenient.accepted).toBe(true);
    expect(lenient.best?.confidence).toBeLessThan(0.99);
    expect(strict.accepted).toBe(false);
    expect(strict.best?.slug).toBe(lenient.best?.slug);
  });
});
