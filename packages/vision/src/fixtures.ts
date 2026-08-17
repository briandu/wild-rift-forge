/**
 * Deterministic synthetic bitmaps for tests.
 *
 * Generated rather than checked in as PNGs so the package needs no image decoder
 * and the fixtures stay readable. Patterns are built from a coarse grid because
 * perceptual hashing needs low-frequency structure — per-pixel noise averages out
 * during the downscale and produces unstable hashes.
 */

import { createBitmap, setPixel, type Bitmap, type Rect } from './bitmap';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function solidBitmap(width: number, height: number, r: number, g: number, b: number): Bitmap {
  const bitmap = createBitmap(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(bitmap, x, y, r, g, b);
    }
  }
  return bitmap;
}

/** A distinct, stable blocky pattern. Different seeds are reliably distinguishable. */
export function patternBitmap(width: number, height: number, seed: number, grid = 8): Bitmap {
  const random = mulberry32(seed * 2654435761);
  const cells = Array.from({ length: grid * grid }, () => ({
    value: 30 + random() * 220,
    red: 0.55 + random() * 0.45,
    green: 0.55 + random() * 0.45,
    blue: 0.55 + random() * 0.45,
  }));

  const bitmap = createBitmap(width, height);
  for (let y = 0; y < height; y += 1) {
    const row = Math.min(grid - 1, Math.floor((y / height) * grid));
    for (let x = 0; x < width; x += 1) {
      const column = Math.min(grid - 1, Math.floor((x / width) * grid));
      const cell = cells[row * grid + column]!;
      setPixel(
        bitmap,
        x,
        y,
        Math.round(cell.value * cell.red),
        Math.round(cell.value * cell.green),
        Math.round(cell.value * cell.blue),
      );
    }
  }
  return bitmap;
}

/** Nearest-neighbour scale and paste, mimicking how a frame downsizes artwork. */
export function pasteBitmap(target: Bitmap, source: Bitmap, rect: Rect): void {
  for (let y = 0; y < rect.height; y += 1) {
    const targetY = rect.y + y;
    if (targetY < 0 || targetY >= target.height) continue;
    const sourceY = Math.min(source.height - 1, Math.floor((y / rect.height) * source.height));
    for (let x = 0; x < rect.width; x += 1) {
      const targetX = rect.x + x;
      if (targetX < 0 || targetX >= target.width) continue;
      const sourceX = Math.min(source.width - 1, Math.floor((x / rect.width) * source.width));
      const from = (sourceY * source.width + sourceX) * 4;
      setPixel(
        target,
        targetX,
        targetY,
        source.data[from] ?? 0,
        source.data[from + 1] ?? 0,
        source.data[from + 2] ?? 0,
      );
    }
  }
}

/**
 * 5×7 glyphs, one byte per row (low five bits, leftmost column is the high bit).
 * Only used to paint HUD titles in tests — the live matcher hashes real game text.
 */
const GLYPH_5X7: Record<string, readonly number[]> = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 0x1f, 0, 0, 0],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
};

/** Paint uppercase HUD text, the way champion-select titles sit on a dark bar. */
export function drawText(
  bitmap: Bitmap,
  text: string,
  originX: number,
  originY: number,
  scale = 2,
  color: { r: number; g: number; b: number } = { r: 236, g: 236, b: 240 },
): void {
  let cursor = originX;
  for (const raw of text.toUpperCase()) {
    const glyph = GLYPH_5X7[raw];
    if (!glyph) {
      cursor += 4 * scale;
      continue;
    }
    for (let row = 0; row < 7; row += 1) {
      const bits = glyph[row] ?? 0;
      for (let column = 0; column < 5; column += 1) {
        if ((bits & (1 << (4 - column))) === 0) continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            setPixel(
              bitmap,
              cursor + column * scale + dx,
              originY + row * scale + dy,
              color.r,
              color.g,
              color.b,
            );
          }
        }
      }
    }
    cursor += 6 * scale;
  }
}

/** Wrap a bitmap in black bars, the way a shared emulator window pads the game. */
export function letterbox(inner: Bitmap, padX: number, padY: number): Bitmap {
  const outer = createBitmap(inner.width + padX * 2, inner.height + padY * 2);
  pasteBitmap(outer, inner, { x: padX, y: padY, width: inner.width, height: inner.height });
  return outer;
}

/**
 * Keep only the inscribed circle, darkening the corners. Wild Rift renders
 * champion-select portraits this way.
 */
export function circleCrop(bitmap: Bitmap, background = 12): Bitmap {
  const out = createBitmap(bitmap.width, bitmap.height);
  const centerX = (bitmap.width - 1) / 2;
  const centerY = (bitmap.height - 1) / 2;
  const radius = Math.min(centerX, centerY);
  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      const inside = (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;
      const from = (y * bitmap.width + x) * 4;
      if (inside) {
        setPixel(
          out,
          x,
          y,
          bitmap.data[from] ?? 0,
          bitmap.data[from + 1] ?? 0,
          bitmap.data[from + 2] ?? 0,
        );
      } else {
        setPixel(out, x, y, background, background, background);
      }
    }
  }
  return out;
}
