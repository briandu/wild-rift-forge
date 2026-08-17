/**
 * Bitmap primitives for champion-select recognition.
 *
 * Everything here is pure and DOM-free: the browser half of the pipeline turns a
 * captured video frame into a {@link Bitmap} and hands it over. Keeping this layer
 * free of canvas APIs is what makes the recognition logic unit-testable.
 */

export type PixelData = Uint8ClampedArray | Uint8Array;

/** An RGBA image, row-major, four bytes per pixel. */
export type Bitmap = {
  width: number;
  height: number;
  data: PixelData;
};

/** A pixel-space rectangle. */
export type Rect = { x: number; y: number; width: number; height: number };

/** A rectangle expressed as fractions of the frame, so it survives a resolution change. */
export type NormalizedRect = { x: number; y: number; width: number; height: number };

/** A single-channel image with values in 0-255. */
export type GrayImage = {
  width: number;
  height: number;
  data: Float32Array;
};

export function createBitmap(width: number, height: number): Bitmap {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function setPixel(
  bitmap: Bitmap,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const offset = (y * bitmap.width + x) * 4;
  bitmap.data[offset] = r;
  bitmap.data[offset + 1] = g;
  bitmap.data[offset + 2] = b;
  bitmap.data[offset + 3] = a;
}

/** Rec. 601 luma. Matches what most perceptual-hash references assume. */
function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function toGray(bitmap: Bitmap): GrayImage {
  const { width, height, data } = bitmap;
  const out = new Float32Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    out[index] = luma(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0);
  }
  return { width, height, data: out };
}

/**
 * Area-average downscale. Only ever used to shrink, which is why a box filter is
 * enough — it is both cheaper and less aliasing-prone than bilinear here.
 */
export function resizeGray(image: GrayImage, targetWidth: number, targetHeight: number): GrayImage {
  const out = new Float32Array(targetWidth * targetHeight);
  const scaleX = image.width / targetWidth;
  const scaleY = image.height / targetHeight;

  for (let ty = 0; ty < targetHeight; ty += 1) {
    const startY = Math.floor(ty * scaleY);
    const endY = Math.max(startY + 1, Math.min(image.height, Math.ceil((ty + 1) * scaleY)));
    for (let tx = 0; tx < targetWidth; tx += 1) {
      const startX = Math.floor(tx * scaleX);
      const endX = Math.max(startX + 1, Math.min(image.width, Math.ceil((tx + 1) * scaleX)));
      let total = 0;
      let count = 0;
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          total += image.data[y * image.width + x] ?? 0;
          count += 1;
        }
      }
      out[ty * targetWidth + tx] = count > 0 ? total / count : 0;
    }
  }

  return { width: targetWidth, height: targetHeight, data: out };
}

function clampRect(bitmap: Bitmap, rect: Rect): Rect {
  const x = Math.max(0, Math.min(bitmap.width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(bitmap.height - 1, Math.round(rect.y)));
  const width = Math.max(1, Math.min(bitmap.width - x, Math.round(rect.width)));
  const height = Math.max(1, Math.min(bitmap.height - y, Math.round(rect.height)));
  return { x, y, width, height };
}

export function cropBitmap(bitmap: Bitmap, rect: Rect): Bitmap {
  const safe = clampRect(bitmap, rect);
  const out = createBitmap(safe.width, safe.height);
  for (let y = 0; y < safe.height; y += 1) {
    const sourceStart = ((safe.y + y) * bitmap.width + safe.x) * 4;
    const targetStart = y * safe.width * 4;
    for (let i = 0; i < safe.width * 4; i += 1) {
      out.data[targetStart + i] = bitmap.data[sourceStart + i] ?? 0;
    }
  }
  return out;
}

/**
 * Keep the central `ratio` of an image.
 *
 * Wild Rift draws champion-select portraits as circles, while the reference
 * library holds square face crops. Hashing the full square would compare the
 * circle's dark corners against real artwork, so both sides get inset to the
 * region inscribed in the circle before hashing.
 */
export function centerCrop(bitmap: Bitmap, ratio: number): Bitmap {
  const safeRatio = Math.max(0.1, Math.min(1, ratio));
  const width = Math.max(1, Math.round(bitmap.width * safeRatio));
  const height = Math.max(1, Math.round(bitmap.height * safeRatio));
  return cropBitmap(bitmap, {
    x: Math.round((bitmap.width - width) / 2),
    y: Math.round((bitmap.height - height) / 2),
    width,
    height,
  });
}

export function toPixelRect(rect: NormalizedRect, width: number, height: number): Rect {
  return {
    x: Math.round(rect.x * width),
    y: Math.round(rect.y * height),
    width: Math.max(1, Math.round(rect.width * width)),
    height: Math.max(1, Math.round(rect.height * height)),
  };
}

export function toNormalizedRect(rect: Rect, width: number, height: number): NormalizedRect {
  return {
    x: rect.x / width,
    y: rect.y / height,
    width: rect.width / width,
    height: rect.height / height,
  };
}

/** Mean RGB over a region, used for the highlighted-row and letterbox checks. */
export function meanColor(bitmap: Bitmap, rect?: Rect): { r: number; g: number; b: number } {
  const area = rect ? clampRect(bitmap, rect) : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const offset = (y * bitmap.width + x) * 4;
      r += bitmap.data[offset] ?? 0;
      g += bitmap.data[offset + 1] ?? 0;
      b += bitmap.data[offset + 2] ?? 0;
      count += 1;
    }
  }
  if (count === 0) return { r: 0, g: 0, b: 0 };
  return { r: r / count, g: g / count, b: b / count };
}

/**
 * Only near-black counts as a letterbox bar. Champion select is a dark screen, so a
 * generous threshold here would happily trim away the game itself.
 */
const LETTERBOX_MAX_LUMA = 8;

/**
 * A real bar never consumes this much of the frame, so a trim that aggressive is
 * treated as a misread (a fade to black, say) and the full frame is kept instead.
 */
const MIN_CONTENT_FRACTION = 0.55;

/**
 * Find the non-letterboxed content inside a captured frame.
 *
 * Sharing an emulator window or a mirrored phone almost always pads the game with
 * black bars, and those bars would shift every region in a saved layout profile.
 */
export function findContentBounds(bitmap: Bitmap, threshold = LETTERBOX_MAX_LUMA): Rect {
  const gray = toGray(bitmap);
  const { width, height } = gray;
  const full: Rect = { x: 0, y: 0, width, height };

  const rowHasContent = (y: number): boolean => {
    for (let x = 0; x < width; x += 1) {
      if ((gray.data[y * width + x] ?? 0) > threshold) return true;
    }
    return false;
  };
  const columnHasContent = (x: number): boolean => {
    for (let y = 0; y < height; y += 1) {
      if ((gray.data[y * width + x] ?? 0) > threshold) return true;
    }
    return false;
  };

  let top = 0;
  while (top < height - 1 && !rowHasContent(top)) top += 1;
  let bottom = height - 1;
  while (bottom > top && !rowHasContent(bottom)) bottom -= 1;
  let left = 0;
  while (left < width - 1 && !columnHasContent(left)) left += 1;
  let right = width - 1;
  while (right > left && !columnHasContent(right)) right -= 1;

  const bounds: Rect = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  if (
    bounds.width < width * MIN_CONTENT_FRACTION ||
    bounds.height < height * MIN_CONTENT_FRACTION
  ) {
    return full;
  }
  return bounds;
}

/** Trim letterbox bars and return both the content frame and where it sat. */
export function contentFrame(bitmap: Bitmap): { frame: Bitmap; bounds: Rect } {
  const bounds = findContentBounds(bitmap);
  const trimmed =
    bounds.x === 0 &&
    bounds.y === 0 &&
    bounds.width === bitmap.width &&
    bounds.height === bitmap.height;
  return { frame: trimmed ? bitmap : cropBitmap(bitmap, bounds), bounds };
}
