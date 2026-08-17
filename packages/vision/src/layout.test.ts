import { describe, expect, it } from 'vitest';
import { createBitmap, setPixel, toPixelRect } from './bitmap';
import { patternBitmap, pasteBitmap } from './fixtures';
import { colorSignature, dhash } from './hash';
import {
  aspectKey,
  BANS_PER_TEAM,
  BAN_TRAY_MAX_Y,
  calibrateLayout,
  CENTER_BAND,
  detectHighlightedRow,
  locateBanTrays,
  locatePortraitColumns,
  parseSlotKey,
  refineRegion,
  SEED_PARAMS_PHONE,
  seedLayoutProfile,
  seedParamsFor,
  slotKey,
  TEAM_SLOTS,
} from './layout';
import type { IconReference } from './match';

describe('slot keys', () => {
  it('round-trips every role', () => {
    for (const role of ['ally', 'enemy', 'ban-ally', 'ban-enemy'] as const) {
      expect(parseSlotKey(slotKey(role, 3))).toEqual({ role, index: 3 });
    }
  });

  it('rejects unknown keys', () => {
    expect(parseSlotKey('nonsense')).toBeNull();
    expect(parseSlotKey('ally-')).toBeNull();
  });
});

describe('aspectKey', () => {
  it('labels common phone and desktop ratios', () => {
    expect(aspectKey(1920, 1080)).toBe('16:9');
    expect(aspectKey(2400, 1080)).toBe('20:9');
    expect(aspectKey(2622, 1206)).toBe('19.5:9');
    expect(aspectKey(2048, 1536)).toBe('4:3');
  });

  it('falls back to a numeric label for odd ratios', () => {
    expect(aspectKey(1000, 100)).toBe('10.00:1');
    expect(aspectKey(100, 0)).toBe('unknown');
  });
});

describe('seedLayoutProfile', () => {
  const profile = seedLayoutProfile(1920, 1080);

  it('covers both teams and both ban trays', () => {
    expect(profile.regions).toHaveLength(TEAM_SLOTS * 2 + BANS_PER_TEAM * 2);
    expect(profile.regions.filter((r) => r.role === 'ally')).toHaveLength(TEAM_SLOTS);
    expect(profile.regions.filter((r) => r.role === 'enemy')).toHaveLength(TEAM_SLOTS);
    expect(profile.regions.filter((r) => r.role === 'ban-ally')).toHaveLength(BANS_PER_TEAM);
    expect(profile.regions.filter((r) => r.role === 'ban-enemy')).toHaveLength(BANS_PER_TEAM);
    expect(profile.source).toBe('seed');
  });

  it('produces regions that are square in pixels', () => {
    for (const region of profile.regions) {
      const rect = toPixelRect(region.rect, 1920, 1080);
      expect(Math.abs(rect.width - rect.height)).toBeLessThanOrEqual(2);
    }
  });

  it('stays square on a tall phone aspect ratio too', () => {
    const tall = seedLayoutProfile(2400, 1080);
    for (const region of tall.regions) {
      const rect = toPixelRect(region.rect, 2400, 1080);
      expect(Math.abs(rect.width - rect.height)).toBeLessThanOrEqual(2);
    }
  });

  it('keeps player rows clear of the central champion grid', () => {
    for (const region of profile.regions.filter((r) => r.role === 'ally' || r.role === 'enemy')) {
      const right = region.rect.x + region.rect.width;
      const outsideLeft = right <= CENTER_BAND.min;
      const outsideRight = region.rect.x >= CENTER_BAND.max;
      expect(outsideLeft || outsideRight).toBe(true);
    }
  });

  it('places ban trays in the top strip', () => {
    for (const region of profile.regions.filter((r) => r.role.startsWith('ban'))) {
      expect(region.rect.y + region.rect.height).toBeLessThanOrEqual(BAN_TRAY_MAX_Y);
    }
  });

  it('orders ban slots left-to-right on both sides', () => {
    const ally = profile.regions.filter((r) => r.role === 'ban-ally').map((r) => r.rect.x);
    const enemy = profile.regions.filter((r) => r.role === 'ban-enemy').map((r) => r.rect.x);
    expect([...ally]).toEqual([...ally].sort((a, b) => a - b));
    expect([...enemy]).toEqual([...enemy].sort((a, b) => a - b));
  });

  it('gives one highlight strip per ally row', () => {
    expect(profile.highlightRegions).toHaveLength(TEAM_SLOTS);
    expect(profile.laneLabelRegions).toHaveLength(TEAM_SLOTS);
  });

  it('uses the phone seed on a 19.5:9 frame', () => {
    expect(seedParamsFor(2622, 1206)).toBe(SEED_PARAMS_PHONE);
    const phone = seedLayoutProfile(2622, 1206);
    const ally0 = phone.regions.find((region) => region.key === 'ally-0')!;
    const allyCenterX = ally0.rect.x + ally0.rect.width / 2;
    expect(allyCenterX).toBeCloseTo(SEED_PARAMS_PHONE.allyCenterX, 3);
  });
});

describe('detectHighlightedRow', () => {
  const profile = seedLayoutProfile(800, 450);

  function frameWithGoldRow(index: number | null) {
    const bitmap = createBitmap(800, 450);
    for (let y = 0; y < 450; y += 1) {
      for (let x = 0; x < 800; x += 1) {
        setPixel(bitmap, x, y, 24, 22, 34);
      }
    }
    if (index !== null) {
      const rect = toPixelRect(profile.highlightRegions[index]!.rect, 800, 450);
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) {
          setPixel(bitmap, x, y, 212, 168, 40);
        }
      }
    }
    return bitmap;
  }

  it('finds the gold row the game marks as the local player', () => {
    for (const index of [0, 2, 4]) {
      const read = detectHighlightedRow(frameWithGoldRow(index), profile.highlightRegions);
      expect(read?.index).toBe(index);
    }
  });

  it('returns null when no row is highlighted', () => {
    expect(detectHighlightedRow(frameWithGoldRow(null), profile.highlightRegions)).toBeNull();
  });

  it('returns null when given no regions', () => {
    expect(detectHighlightedRow(frameWithGoldRow(1), [])).toBeNull();
  });
});

describe('refineRegion', () => {
  const size = 44;

  function frameWithIcon(at: { x: number; y: number }, seed: number) {
    const frame = createBitmap(300, 300);
    for (let y = 0; y < 300; y += 1) {
      for (let x = 0; x < 300; x += 1) {
        setPixel(frame, x, y, 16, 14, 24);
      }
    }
    pasteBitmap(frame, patternBitmap(64, 64, seed), { x: at.x, y: at.y, width: size, height: size });
    return frame;
  }

  const references: IconReference[] = [40, 41, 42].map((seed) => {
    const art = patternBitmap(64, 64, seed);
    return { slug: `champ-${seed}`, hash: dhash(art), color: colorSignature(art) };
  });

  it('locks onto a portrait offset from its seed position', () => {
    const frame = frameWithIcon({ x: 120, y: 130 }, 41);
    const hit = refineRegion(frame, { x: 112, y: 121, width: size, height: size }, references);
    expect(hit?.slug).toBe('champ-41');
    expect(Math.abs((hit?.rect.x ?? 0) - 120)).toBeLessThanOrEqual(4);
    expect(Math.abs((hit?.rect.y ?? 0) - 130)).toBeLessThanOrEqual(4);
  });

  it('finds a portrait rendered slightly larger than the seed size', () => {
    const frame = createBitmap(300, 300);
    pasteBitmap(frame, patternBitmap(64, 64, 42), { x: 100, y: 100, width: 50, height: 50 });
    const hit = refineRegion(frame, { x: 103, y: 103, width: size, height: size }, references);
    expect(hit?.slug).toBe('champ-42');
  });

  it('returns null for an empty slot', () => {
    const frame = createBitmap(300, 300);
    expect(refineRegion(frame, { x: 100, y: 100, width: size, height: size }, references)).toBeNull();
  });

  it('returns null with no references or a degenerate seed rect', () => {
    const frame = frameWithIcon({ x: 120, y: 130 }, 41);
    expect(refineRegion(frame, { x: 120, y: 130, width: size, height: size }, [])).toBeNull();
    expect(refineRegion(frame, { x: 0, y: 0, width: 4, height: 4 }, references)).toBeNull();
  });

  it('does not search outside the frame', () => {
    const frame = frameWithIcon({ x: 2, y: 2 }, 40);
    expect(() => refineRegion(frame, { x: 0, y: 0, width: size, height: size }, references)).not.toThrow();
  });
});

describe('calibrateLayout', () => {
  const width = 800;
  const height = 450;

  function syntheticFrame() {
    const frame = createBitmap(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(frame, x, y, 16, 14, 24);
      }
    }
    const profile = seedLayoutProfile(width, height);
    const references: IconReference[] = [];
    let seed = 100;

    // Only the ten player portraits are drawn; the ban trays stay empty, which is
    // what a mid-pick frame looks like.
    for (const region of profile.regions.filter((r) => r.role === 'ally' || r.role === 'enemy')) {
      const art = patternBitmap(64, 64, seed);
      references.push({ slug: `champ-${seed}`, hash: dhash(art), color: colorSignature(art) });
      const rect = toPixelRect(region.rect, width, height);
      // Offset by a few pixels so calibration has something to correct.
      pasteBitmap(frame, art, { ...rect, x: rect.x + 3, y: rect.y + 2 });
      seed += 1;
    }

    // Decoys in the central champion grid, which must never become draft state.
    for (let column = 0; column < 5; column += 1) {
      const art = patternBitmap(64, 64, seed);
      references.push({ slug: `grid-${seed}`, hash: dhash(art), color: colorSignature(art) });
      pasteBitmap(frame, art, { x: 240 + column * 70, y: 120, width: 56, height: 56 });
      seed += 1;
    }

    return { frame, references };
  }

  it('locks the profile onto the real portrait positions', () => {
    const { frame, references } = syntheticFrame();
    const { profile, hits } = calibrateLayout(frame, references);
    expect(profile.source).toBe('calibrated');
    expect(profile.regions).toHaveLength(TEAM_SLOTS * 2 + BANS_PER_TEAM * 2);
    expect(profile.aspectKey).toBe('16:9');
    expect(hits.size).toBeGreaterThanOrEqual(8);
  });

  it('never resolves a slot to a champion from the central grid', () => {
    const { frame, references } = syntheticFrame();
    const { hits } = calibrateLayout(frame, references);
    expect([...hits.values()].every((hit) => !hit.slug.startsWith('grid-'))).toBe(true);
  });

  it('keeps seed rects for slots it cannot see', () => {
    const { frame, references } = syntheticFrame();
    const seed = seedLayoutProfile(width, height);
    const { profile } = calibrateLayout(frame, references);
    const banKey = slotKey('ban-ally', 0);
    expect(profile.regions.find((r) => r.key === banKey)?.rect).toEqual(
      seed.regions.find((r) => r.key === banKey)?.rect,
    );
  });

  it('stays on the seed profile when the frame is blank', () => {
    const { profile } = calibrateLayout(createBitmap(width, height), []);
    expect(profile.source).toBe('seed');
  });
});

describe('locateBanTrays', () => {
  const width = 1024;
  const height = 471;

  /** Paint five ban squares per side at a given offset, pitch and size. */
  function trayFrame(options: {
    allyLeft: number;
    enemyLeft: number;
    top: number;
    pitch: number;
    size: number;
    filled?: number[];
  }) {
    const { allyLeft, enemyLeft, top, pitch, size, filled = [0, 1, 2, 3, 4] } = options;
    const frame = createBitmap(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) setPixel(frame, x, y, 14, 12, 20);
    }
    let seed = 40;
    for (const left of [allyLeft, enemyLeft]) {
      for (const index of filled) {
        pasteBitmap(frame, patternBitmap(64, 64, seed), {
          x: left + index * pitch,
          y: top,
          width: size,
          height: size,
        });
        seed += 1;
      }
    }
    return frame;
  }

  it('measures both trays from the frame', () => {
    const frame = trayFrame({ allyLeft: 36, enemyLeft: 770, top: 30, pitch: 41, size: 33 });
    const regions = locateBanTrays(frame)!;
    expect(regions).not.toBeNull();

    const ally = regions
      .filter((region) => region.role === 'ban-ally')
      .map((region) => toPixelRect(region.rect, width, height));
    expect(ally.map((rect) => rect.x)).toEqual([36, 77, 118, 159, 200]);
    expect(ally[0]!.width).toBeGreaterThanOrEqual(31);
    expect(ally[0]!.width).toBeLessThanOrEqual(35);

    const enemy = regions
      .filter((region) => region.role === 'ban-enemy')
      .map((region) => toPixelRect(region.rect, width, height));
    expect(enemy.map((rect) => rect.x)).toEqual([770, 811, 852, 893, 934]);
  });

  it('follows a tray that moved and rescaled', () => {
    const frame = trayFrame({ allyLeft: 85, enemyLeft: 758, top: 9, pitch: 38, size: 30 });
    const ally = locateBanTrays(frame)!
      .filter((region) => region.role === 'ban-ally')
      .map((region) => toPixelRect(region.rect, width, height));
    expect(ally.map((rect) => rect.x)).toEqual([85, 123, 161, 199, 237]);
  });

  it('recovers empty slots from the ones that are filled', () => {
    const frame = trayFrame({
      allyLeft: 36,
      enemyLeft: 770,
      top: 30,
      pitch: 41,
      size: 33,
      filled: [0, 2, 4],
    });
    const ally = locateBanTrays(frame)!
      .filter((region) => region.role === 'ban-ally')
      .map((region) => toPixelRect(region.rect, width, height));
    expect(ally.map((rect) => rect.x)).toEqual([36, 77, 118, 159, 200]);
  });

  it('declines rather than fitting noise when no bans are on screen', () => {
    const frame = createBitmap(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) setPixel(frame, x, y, 14, 12, 20);
    }
    expect(locateBanTrays(frame)).toBeNull();
  });
});

describe('locatePortraitColumns', () => {
  const width = 800;
  const height = 450;

  function columnFrame(allyX: number, enemyX: number, firstY: number, pitch: number, size: number) {
    const frame = createBitmap(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) setPixel(frame, x, y, 14, 12, 20);
    }
    let seed = 70;
    for (const left of [allyX, enemyX]) {
      for (let index = 0; index < TEAM_SLOTS; index += 1) {
        pasteBitmap(frame, patternBitmap(64, 64, seed), {
          x: left,
          y: firstY + index * pitch,
          width: size,
          height: size,
        });
        seed += 1;
      }
    }
    return frame;
  }

  it('measures both portrait columns from the frame', () => {
    const frame = columnFrame(90, 660, 70, 62, 48);
    const regions = locatePortraitColumns(frame)!;
    expect(regions).not.toBeNull();
    const ally = regions
      .filter((region) => region.role === 'ally')
      .map((region) => toPixelRect(region.rect, width, height));
    expect(ally).toHaveLength(TEAM_SLOTS);
    expect(ally[0]!.x).toBeGreaterThanOrEqual(78);
    expect(ally[0]!.x).toBeLessThanOrEqual(102);
    expect(ally[4]!.y).toBeGreaterThan(ally[0]!.y);
    const enemy = regions
      .filter((region) => region.role === 'enemy')
      .map((region) => toPixelRect(region.rect, width, height));
    expect(enemy[0]!.x).toBeGreaterThanOrEqual(640);
    expect(enemy[0]!.x).toBeLessThanOrEqual(680);
  });

  it('declines rather than fitting noise when no portraits are on screen', () => {
    const frame = createBitmap(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) setPixel(frame, x, y, 14, 12, 20);
    }
    expect(locatePortraitColumns(frame)).toBeNull();
  });
});
