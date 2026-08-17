import { describe, expect, it } from 'vitest';
import { patternBitmap, solidBitmap } from './fixtures';
import { colorSignature, dhash, isColorSignature, isHash64 } from './hash';
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

  it('ranks a closer colour over a slightly closer hash', () => {
    const tile = patternBitmap(64, 64, 3);
    const hash = dhash(tile);
    const color = colorSignature(tile);
    const decoyHash = `${hash.slice(0, 14)}00`;
    const result = matchTile(hash, color, [
      { slug: 'real', hash, color, variant: 'captured' },
      {
        slug: 'decoy',
        hash: decoyHash,
        color: colorSignature(patternBitmap(64, 64, 99)),
        variant: 'captured',
      },
    ]);
    expect(result.best?.slug).toBe('real');
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

/** Ban tiles measured off a real ranked frame, with the champion each one shows. */
const BAN_TILES: Array<{ slug: string; hash: string; color: string }> = [
  {
    slug: 'mordekaiser',
    hash: 'e6e0e4e4e0f0f0f2',
    color:
      '313d39282d2c3639394c5b5a283d372224234a4e4c5d6e6a365c4f1e24232728273a403f5da78d1925221f21212e302f',
  },
  {
    slug: 'yuumi',
    hash: 'ddd70e1d173f0c80',
    color:
      '9b7b616b4f46573f395038465e535ca0aeba54667e333a584a54777d8ca87e8aa75e648d43426c47456e47416a6a525d',
  },
  {
    slug: 'jax',
    hash: '0607071f81c6eef6',
    color:
      '1a1c34323e6f4a668f172241261e3d404873445d7c192543332949212640273c591c274a645a8c362e48242236171b2e',
  },
  {
    slug: 'syndra',
    hash: 'a7ff66621387939a',
    color:
      '6b519e463965433f602a284b46355c34223e3a26464131593d234b6841679b7ea75c4a705c43729b5c9a86638f504660',
  },
  {
    slug: 'yunara',
    hash: '1f3d7cfe66272607',
    color:
      '473ea0594c883a2770321d6f7074cc68567d4e384c3a25647b7acb755d79835869593a7f3b2c6769495b9867695d3773',
  },
];

describe('CAPTURED_ICONS', () => {
  it('covers the roster with well-formed signatures', async () => {
    const { CAPTURED_ICONS } = await import('./captured-icons');
    expect(CAPTURED_ICONS.length).toBeGreaterThan(100);
    expect(new Set(CAPTURED_ICONS.map((icon) => icon.slug)).size).toBeGreaterThan(100);
    expect(new Set(CAPTURED_ICONS.map((icon) => `${icon.slug}:${icon.hash}`)).size).toBe(
      CAPTURED_ICONS.length,
    );
    for (const icon of CAPTURED_ICONS) {
      expect(icon.variant).toBe('captured');
      expect(isHash64(icon.hash)).toBe(true);
      expect(isColorSignature(icon.color)).toBe(true);
    }
  });

  it('identifies champions from real ban tiles', async () => {
    const { CAPTURED_ICONS } = await import('./captured-icons');
    for (const tile of BAN_TILES) {
      const result = matchTile(tile.hash, tile.color, CAPTURED_ICONS);
      expect(result.best?.slug).toBe(tile.slug);
      expect(result.accepted).toBe(true);
    }
  });

  it('leaves an unused ban slot unmatched rather than guessing', async () => {
    const { CAPTURED_ICONS } = await import('./captured-icons');
    const empty = matchTile(
      'e4f8d69aaab6cc70',
      '1515171213161113161315191314161b1d1d161817131417131416161719191c1d121517141517131416131416131517',
      CAPTURED_ICONS,
    );
    expect(empty.accepted).toBe(false);
  });
});
