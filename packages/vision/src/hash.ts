import { centerCrop, resizeGray, toGray, type Bitmap } from './bitmap';

/** A 64-bit difference hash, serialized as 16 lowercase hex characters. */
export type Hash64 = string;

/**
 * A 4x4 grid of average RGB values, serialized as 96 lowercase hex characters.
 * Used only to break ties between champions whose luma structure is similar.
 */
export type ColorSignature = string;

export const HASH_ALGO = 'dhash8x8';

/** Portrait inset applied before hashing. See {@link centerCrop}. */
export const ICON_INSET = 0.74;

const HASH_HEX_LENGTH = 16;
const COLOR_GRID = 4;
const COLOR_HEX_LENGTH = COLOR_GRID * COLOR_GRID * 3 * 2;

const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

function hexValue(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 102) return code - 87;
  if (code >= 65 && code <= 70) return code - 55;
  return -1;
}

function bitsToHex(bits: boolean[]): string {
  let out = '';
  for (let nibble = 0; nibble < bits.length / 4; nibble += 1) {
    let value = 0;
    for (let bit = 0; bit < 4; bit += 1) {
      if (bits[nibble * 4 + bit]) {
        value |= 1 << (3 - bit);
      }
    }
    out += value.toString(16);
  }
  return out;
}

export function isHash64(value: unknown): value is Hash64 {
  return (
    typeof value === 'string' &&
    value.length === HASH_HEX_LENGTH &&
    [...value].every((char) => hexValue(char) >= 0)
  );
}

export function isColorSignature(value: unknown): value is ColorSignature {
  return (
    typeof value === 'string' &&
    value.length === COLOR_HEX_LENGTH &&
    [...value].every((char) => hexValue(char) >= 0)
  );
}

/**
 * Difference hash: downscale to 9x8 grey, then record whether each pixel is
 * brighter than its right-hand neighbour. Robust to scale, compression and
 * moderate brightness shifts, which is exactly what varies between an emulator
 * capture and the hosted reference art.
 */
export function dhash(bitmap: Bitmap, inset = ICON_INSET): Hash64 {
  const source = inset < 1 ? centerCrop(bitmap, inset) : bitmap;
  const gray = resizeGray(toGray(source), 9, 8);
  const bits: boolean[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = gray.data[y * 9 + x] ?? 0;
      const right = gray.data[y * 9 + x + 1] ?? 0;
      bits.push(left > right);
    }
  }
  return bitsToHex(bits);
}

export function colorSignature(bitmap: Bitmap, inset = ICON_INSET): ColorSignature {
  const source = inset < 1 ? centerCrop(bitmap, inset) : bitmap;
  const cellWidth = source.width / COLOR_GRID;
  const cellHeight = source.height / COLOR_GRID;
  let out = '';
  for (let row = 0; row < COLOR_GRID; row += 1) {
    for (let column = 0; column < COLOR_GRID; column += 1) {
      const startX = Math.floor(column * cellWidth);
      const endX = Math.max(startX + 1, Math.floor((column + 1) * cellWidth));
      const startY = Math.floor(row * cellHeight);
      const endY = Math.max(startY + 1, Math.floor((row + 1) * cellHeight));
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let y = startY; y < endY && y < source.height; y += 1) {
        for (let x = startX; x < endX && x < source.width; x += 1) {
          const offset = (y * source.width + x) * 4;
          r += source.data[offset] ?? 0;
          g += source.data[offset + 1] ?? 0;
          b += source.data[offset + 2] ?? 0;
          count += 1;
        }
      }
      const safe = Math.max(1, count);
      for (const channel of [r / safe, g / safe, b / safe]) {
        out += Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
      }
    }
  }
  return out;
}

/**
 * Bit distance between two hashes, 0 (identical) to 64 (inverted).
 * Malformed input yields Infinity so a corrupt reference can never win a match.
 */
export function hamming(a: Hash64, b: Hash64): number {
  if (!isHash64(a) || !isHash64(b)) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < HASH_HEX_LENGTH; index += 1) {
    const diff = hexValue(a[index]!) ^ hexValue(b[index]!);
    distance += NIBBLE_BITS[diff] ?? 0;
  }
  return distance;
}

/** Mean per-channel difference between two colour signatures, normalized to 0-1. */
export function colorDistance(a: ColorSignature, b: ColorSignature): number {
  if (!isColorSignature(a) || !isColorSignature(b)) return 1;
  let total = 0;
  for (let index = 0; index < COLOR_HEX_LENGTH; index += 2) {
    const left = hexValue(a[index]!) * 16 + hexValue(a[index + 1]!);
    const right = hexValue(b[index]!) * 16 + hexValue(b[index + 1]!);
    total += Math.abs(left - right);
  }
  return total / (COLOR_HEX_LENGTH / 2) / 255;
}
