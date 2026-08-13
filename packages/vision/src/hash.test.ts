import { describe, expect, it } from 'vitest';
import { createBitmap, cropBitmap } from './bitmap';
import { circleCrop, patternBitmap, solidBitmap } from './fixtures';
import {
  colorDistance,
  colorSignature,
  dhash,
  hamming,
  isColorSignature,
  isHash64,
} from './hash';

describe('dhash', () => {
  it('produces a 16-character hex hash', () => {
    const hash = dhash(patternBitmap(64, 64, 1));
    expect(hash).toHaveLength(16);
    expect(isHash64(hash)).toBe(true);
  });

  it('is deterministic', () => {
    expect(dhash(patternBitmap(64, 64, 7))).toBe(dhash(patternBitmap(64, 64, 7)));
  });

  it('survives a downscale, so hosted art matches a smaller in-game tile', () => {
    const large = patternBitmap(128, 128, 3);
    const small = patternBitmap(40, 40, 3);
    expect(hamming(dhash(large), dhash(small))).toBeLessThanOrEqual(6);
  });

  it('ignores a uniform brightness shift', () => {
    const base = patternBitmap(64, 64, 11);
    const brighter = createBitmap(64, 64);
    for (let index = 0; index < base.data.length; index += 4) {
      brighter.data[index] = Math.min(255, (base.data[index] ?? 0) + 24);
      brighter.data[index + 1] = Math.min(255, (base.data[index + 1] ?? 0) + 24);
      brighter.data[index + 2] = Math.min(255, (base.data[index + 2] ?? 0) + 24);
      brighter.data[index + 3] = 255;
    }
    expect(hamming(dhash(base), dhash(brighter))).toBeLessThanOrEqual(4);
  });

  it('separates unrelated artwork', () => {
    const distances: number[] = [];
    for (let seed = 1; seed <= 6; seed += 1) {
      for (let other = seed + 1; other <= 6; other += 1) {
        distances.push(hamming(dhash(patternBitmap(64, 64, seed)), dhash(patternBitmap(64, 64, other))));
      }
    }
    expect(Math.min(...distances)).toBeGreaterThan(10);
  });

  it('is unaffected by the circular mask the game applies to portraits', () => {
    const square = patternBitmap(64, 64, 21);
    const circular = circleCrop(square);
    // The default inset keeps only the region inscribed in the circle, so the
    // darkened corners must not change the hash.
    expect(hamming(dhash(square), dhash(circular))).toBeLessThanOrEqual(2);
  });

  it('would be corrupted by the circular mask without the inset', () => {
    const square = patternBitmap(64, 64, 21);
    const circular = circleCrop(square);
    expect(hamming(dhash(square, 1), dhash(circular, 1))).toBeGreaterThan(
      hamming(dhash(square), dhash(circular)),
    );
  });
});

describe('hamming', () => {
  it('is zero for identical hashes and finite for valid input', () => {
    const hash = dhash(patternBitmap(64, 64, 5));
    expect(hamming(hash, hash)).toBe(0);
    expect(hamming('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });

  it('rejects malformed hashes so a corrupt reference can never win', () => {
    expect(hamming('nope', '0000000000000000')).toBe(Number.POSITIVE_INFINITY);
    expect(hamming('0000000000000000', 'zzzzzzzzzzzzzzzz')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('colorSignature', () => {
  it('produces a 96-character hex signature', () => {
    const signature = colorSignature(patternBitmap(64, 64, 2));
    expect(signature).toHaveLength(96);
    expect(isColorSignature(signature)).toBe(true);
  });

  it('scores identical images as zero distance and opposites as far apart', () => {
    const red = colorSignature(solidBitmap(32, 32, 220, 20, 20));
    const blue = colorSignature(solidBitmap(32, 32, 20, 20, 220));
    expect(colorDistance(red, red)).toBe(0);
    expect(colorDistance(red, blue)).toBeGreaterThan(0.4);
  });

  it('treats malformed signatures as maximally distant', () => {
    expect(colorDistance('short', colorSignature(patternBitmap(32, 32, 1)))).toBe(1);
  });

  it('distinguishes tiles that share luma structure but differ in hue', () => {
    const base = patternBitmap(64, 64, 9);
    const tinted = createBitmap(64, 64);
    for (let index = 0; index < base.data.length; index += 4) {
      tinted.data[index] = base.data[index + 2] ?? 0;
      tinted.data[index + 1] = base.data[index + 1] ?? 0;
      tinted.data[index + 2] = base.data[index] ?? 0;
      tinted.data[index + 3] = 255;
    }
    expect(colorDistance(colorSignature(base), colorSignature(tinted))).toBeGreaterThan(0.02);
  });
});

describe('crop interaction', () => {
  it('hashes a cropped region independently of its source position', () => {
    const frame = createBitmap(200, 200);
    const icon = patternBitmap(50, 50, 13);
    for (let y = 0; y < 50; y += 1) {
      for (let x = 0; x < 50; x += 1) {
        const from = (y * 50 + x) * 4;
        const to = ((y + 70) * 200 + (x + 40)) * 4;
        frame.data[to] = icon.data[from] ?? 0;
        frame.data[to + 1] = icon.data[from + 1] ?? 0;
        frame.data[to + 2] = icon.data[from + 2] ?? 0;
        frame.data[to + 3] = 255;
      }
    }
    const recovered = cropBitmap(frame, { x: 40, y: 70, width: 50, height: 50 });
    expect(hamming(dhash(recovered), dhash(icon))).toBe(0);
  });
});
