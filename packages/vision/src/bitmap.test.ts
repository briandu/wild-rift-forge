import { describe, expect, it } from 'vitest';
import {
  centerCrop,
  contentFrame,
  createBitmap,
  cropBitmap,
  findContentBounds,
  meanColor,
  resizeGray,
  toGray,
  toNormalizedRect,
  toPixelRect,
} from './bitmap';
import { letterbox, patternBitmap, solidBitmap } from './fixtures';

describe('findContentBounds', () => {
  it('trims the black bars a shared emulator window adds', () => {
    const inner = solidBitmap(120, 80, 90, 90, 90);
    const bounds = findContentBounds(letterbox(inner, 20, 12));
    expect(bounds).toEqual({ x: 20, y: 12, width: 120, height: 80 });
  });

  it('returns the whole frame when there are no bars', () => {
    const bitmap = solidBitmap(40, 30, 200, 200, 200);
    expect(findContentBounds(bitmap)).toEqual({ x: 0, y: 0, width: 40, height: 30 });
  });

  it('keeps a dark game frame intact', () => {
    // Champion select is nearly black in places; trimming it would shift every
    // region in the layout profile.
    const bitmap = solidBitmap(200, 120, 16, 14, 24);
    expect(findContentBounds(bitmap)).toEqual({ x: 0, y: 0, width: 200, height: 120 });
  });

  it('refuses an implausibly aggressive trim, such as a fade to black', () => {
    const frame = createBitmap(200, 120);
    const spark = solidBitmap(10, 8, 255, 255, 255);
    const padded = letterbox(spark, 95, 56);
    expect(findContentBounds(padded)).toEqual({ x: 0, y: 0, width: padded.width, height: padded.height });
    expect(findContentBounds(frame)).toEqual({ x: 0, y: 0, width: 200, height: 120 });
  });

  it('does not collapse an entirely black frame', () => {
    const bounds = findContentBounds(createBitmap(20, 10));
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });
});

describe('contentFrame', () => {
  it('returns the inner frame and the bars it sat in', () => {
    const inner = solidBitmap(120, 80, 90, 90, 90);
    const { frame, bounds } = contentFrame(letterbox(inner, 20, 12));
    expect(bounds).toEqual({ x: 20, y: 12, width: 120, height: 80 });
    expect(frame.width).toBe(120);
    expect(frame.height).toBe(80);
  });
});

describe('cropBitmap', () => {
  it('copies the requested region', () => {
    const bitmap = solidBitmap(10, 10, 10, 20, 30);
    const crop = cropBitmap(bitmap, { x: 2, y: 3, width: 4, height: 5 });
    expect(crop.width).toBe(4);
    expect(crop.height).toBe(5);
    expect(meanColor(crop)).toEqual({ r: 10, g: 20, b: 30 });
  });

  it('clamps regions that fall outside the frame', () => {
    const bitmap = solidBitmap(10, 10, 5, 5, 5);
    const crop = cropBitmap(bitmap, { x: 8, y: 8, width: 50, height: 50 });
    expect(crop.width).toBe(2);
    expect(crop.height).toBe(2);
  });
});

describe('centerCrop', () => {
  it('keeps the middle of the image', () => {
    const bitmap = createBitmap(10, 10);
    // Mark only the centre 4x4 so the crop is verifiable by brightness.
    for (let y = 3; y < 7; y += 1) {
      for (let x = 3; x < 7; x += 1) {
        const offset = (y * 10 + x) * 4;
        bitmap.data[offset] = 255;
        bitmap.data[offset + 1] = 255;
        bitmap.data[offset + 2] = 255;
        bitmap.data[offset + 3] = 255;
      }
    }
    const crop = centerCrop(bitmap, 0.4);
    expect(crop.width).toBe(4);
    expect(meanColor(crop).r).toBe(255);
  });

  it('is a no-op at ratio 1 and clamps absurd ratios', () => {
    const bitmap = patternBitmap(20, 20, 4);
    expect(centerCrop(bitmap, 1).width).toBe(20);
    expect(centerCrop(bitmap, 5).width).toBe(20);
    expect(centerCrop(bitmap, 0).width).toBeGreaterThan(0);
  });
});

describe('resizeGray', () => {
  it('area-averages when shrinking', () => {
    const bitmap = createBitmap(4, 2);
    for (let x = 0; x < 4; x += 1) {
      for (let y = 0; y < 2; y += 1) {
        const value = x < 2 ? 0 : 200;
        const offset = (y * 4 + x) * 4;
        bitmap.data[offset] = value;
        bitmap.data[offset + 1] = value;
        bitmap.data[offset + 2] = value;
        bitmap.data[offset + 3] = 255;
      }
    }
    const resized = resizeGray(toGray(bitmap), 2, 1);
    expect(resized.data[0]).toBeCloseTo(0, 1);
    expect(resized.data[1]).toBeCloseTo(200, 1);
  });

  it('produces the requested dimensions', () => {
    const resized = resizeGray(toGray(patternBitmap(64, 64, 1)), 9, 8);
    expect(resized.width).toBe(9);
    expect(resized.height).toBe(8);
    expect(resized.data).toHaveLength(72);
  });
});

describe('rect conversion', () => {
  it('round-trips between pixel and normalized space', () => {
    const rect = { x: 0.25, y: 0.5, width: 0.1, height: 0.2 };
    const pixels = toPixelRect(rect, 800, 450);
    expect(pixels).toEqual({ x: 200, y: 225, width: 80, height: 90 });
    const back = toNormalizedRect(pixels, 800, 450);
    expect(back.x).toBeCloseTo(rect.x, 5);
    expect(back.height).toBeCloseTo(rect.height, 5);
  });

  it('never produces a zero-sized pixel rect', () => {
    const pixels = toPixelRect({ x: 0, y: 0, width: 0.0001, height: 0.0001 }, 100, 100);
    expect(pixels.width).toBeGreaterThan(0);
    expect(pixels.height).toBeGreaterThan(0);
  });
});

describe('meanColor', () => {
  it('averages only the requested region', () => {
    const bitmap = createBitmap(4, 1);
    bitmap.data.set([255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    expect(meanColor(bitmap, { x: 0, y: 0, width: 1, height: 1 }).r).toBe(255);
    expect(meanColor(bitmap, { x: 1, y: 0, width: 3, height: 1 }).r).toBe(0);
  });
});
