import { describe, expect, it } from 'vitest';
import { createBitmap, setPixel, toPixelRect, type Bitmap } from './bitmap';
import { letterbox, patternBitmap, pasteBitmap } from './fixtures';
import { colorSignature, dhash } from './hash';
import { calibrateLayout, seedLayoutProfile, slotKey } from './layout';
import type { IconReference } from './match';
import { drawText } from './fixtures';
import { readHudTitle, type PhaseTemplate } from './phase';
import { readDraft } from './read';

const WIDTH = 800;
const HEIGHT = 450;

function darkFrame(width = WIDTH, height = HEIGHT): Bitmap {
  const frame = createBitmap(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(frame, x, y, 16, 14, 24);
    }
  }
  return frame;
}

type Lobby = {
  frame: Bitmap;
  references: IconReference[];
  expected: Map<string, string>;
};

/**
 * Paint a champion-select frame at the seed positions.
 * `roles` selects which slot groups get portraits, so a ban phase (ally portraits
 * only) can be distinguished from a pick phase.
 */
function lobby(options: {
  roles?: Array<'ally' | 'enemy' | 'ban-ally' | 'ban-enemy'>;
  goldRow?: number;
  offset?: { x: number; y: number };
} = {}): Lobby {
  const { roles = ['ally', 'enemy'], goldRow, offset = { x: 0, y: 0 } } = options;
  const frame = darkFrame();
  const profile = seedLayoutProfile(WIDTH, HEIGHT);
  const references: IconReference[] = [];
  const expected = new Map<string, string>();
  let seed = 200;

  for (const region of profile.regions) {
    const art = patternBitmap(64, 64, seed);
    const slug = `champ-${seed}`;
    references.push({ slug, hash: dhash(art), color: colorSignature(art) });
    if (roles.includes(region.role)) {
      const rect = toPixelRect(region.rect, WIDTH, HEIGHT);
      pasteBitmap(frame, art, { ...rect, x: rect.x + offset.x, y: rect.y + offset.y });
      expected.set(region.key, slug);
    }
    seed += 1;
  }

  if (goldRow !== undefined) {
    const rect = toPixelRect(profile.highlightRegions[goldRow]!.rect, WIDTH, HEIGHT);
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        setPixel(frame, x, y, 212, 168, 40);
      }
    }
  }

  return { frame, references, expected };
}

describe('readDraft', () => {
  it('identifies every populated slot in a pick-phase frame', () => {
    const { frame, references, expected } = lobby();
    const read = readDraft(frame, references);
    for (const [key, slug] of expected) {
      expect(read.slots.find((slot) => slot.key === key)?.slug).toBe(slug);
    }
  });

  it('leaves empty ban slots unresolved instead of guessing', () => {
    const { frame, references } = lobby({ roles: ['ally', 'enemy'] });
    const read = readDraft(frame, references);
    const bans = read.slots.filter((slot) => slot.role.startsWith('ban'));
    expect(bans).toHaveLength(10);
    expect(bans.every((slot) => slot.slug === null)).toBe(true);
  });

  it('reads bans when the trays are populated', () => {
    const { frame, references, expected } = lobby({
      roles: ['ally', 'enemy', 'ban-ally', 'ban-enemy'],
    });
    const read = readDraft(frame, references);
    expect(read.slots.filter((slot) => slot.slug).length).toBe(expected.size);
    expect(read.slots.find((slot) => slot.key === slotKey('ban-enemy', 2))?.slug).toBe(
      expected.get(slotKey('ban-enemy', 2)),
    );
  });

  it('returns a candidate and confidence for slots it rejects', () => {
    const { frame, references } = lobby({ roles: ['ally'] });
    const read = readDraft(frame, references);
    const enemy = read.slots.find((slot) => slot.role === 'enemy');
    expect(enemy?.slug).toBeNull();
    expect(enemy?.candidate).toBeTruthy();
    expect(enemy?.confidence).toBeLessThan(1);
  });

  it('never assigns the same champion to two slots', () => {
    const frame = darkFrame();
    const profile = seedLayoutProfile(WIDTH, HEIGHT);
    const art = patternBitmap(64, 64, 300);
    const references: IconReference[] = [
      { slug: 'twin', hash: dhash(art), color: colorSignature(art) },
      ...[301, 302, 303].map((seed) => {
        const other = patternBitmap(64, 64, seed);
        return { slug: `other-${seed}`, hash: dhash(other), color: colorSignature(other) };
      }),
    ];
    // The same portrait in two ally slots: only one may keep it.
    for (const index of [0, 1]) {
      const region = profile.regions.find((r) => r.key === slotKey('ally', index))!;
      pasteBitmap(frame, art, toPixelRect(region.rect, WIDTH, HEIGHT));
    }
    const read = readDraft(frame, references);
    const claimed = read.slots.filter((slot) => slot.slug === 'twin');
    expect(claimed).toHaveLength(1);
  });

  it('trims letterbox bars before locating slots', () => {
    const { frame, references, expected } = lobby();
    const padded = letterbox(frame, 60, 40);
    const read = readDraft(padded, references);
    expect(read.contentBounds).toEqual({ x: 60, y: 40, width: WIDTH, height: HEIGHT });
    expect(read.slots.find((slot) => slot.key === slotKey('ally', 0))?.slug).toBe(
      expected.get(slotKey('ally', 0)),
    );
  });

  it('honours skipTrim for an already normalized frame', () => {
    const { frame, references } = lobby();
    const read = readDraft(frame, references, { skipTrim: true });
    expect(read.contentBounds).toEqual({ x: 0, y: 0, width: WIDTH, height: HEIGHT });
  });

  it('detects the local player from the gold row', () => {
    const { frame, references } = lobby({ goldRow: 3 });
    expect(readDraft(frame, references).mySlotIndex).toBe(3);
  });

  it('reports a null slot owner when no row is highlighted', () => {
    const { frame, references } = lobby();
    expect(readDraft(frame, references).mySlotIndex).toBeNull();
  });

  it('calls a frame with both teams filled the pick phase', () => {
    const { frame, references } = lobby();
    expect(readDraft(frame, references).phase).toBe('pick');
  });

  it('calls ally-only portraits the ban phase, since those are avatars', () => {
    const { frame, references } = lobby({ roles: ['ally'] });
    expect(readDraft(frame, references).phase).toBe('ban');
  });

  it('reports an unknown phase for an empty lobby', () => {
    const { references } = lobby();
    expect(readDraft(darkFrame(), references).phase).toBe('unknown');
  });

  it('prefers the HUD title over the portrait-occupancy guess', () => {
    const { frame, references } = lobby({ roles: ['ally'] });
    drawText(frame, 'SELECT YOUR CHAMPION!', 220, 6, 2);
    const title = readHudTitle(frame);
    expect(title).not.toBeNull();
    const templates: PhaseTemplate[] = [
      { phase: 'pick-self', label: 'SELECT YOUR CHAMPION!', hash: title!.hash, aspect: title!.aspect },
    ];
    expect(readDraft(frame, references).phase).toBe('ban');
    expect(readDraft(frame, references, { phaseTemplates: templates }).phase).toBe('pick-self');
  });

  it('reads a near-aligned lobby once calibrated', () => {
    const { frame, references, expected } = lobby({ offset: { x: 3, y: 2 } });
    const { profile } = calibrateLayout(frame, references);
    const read = readDraft(frame, references, { profile });
    expect(profile.source).toBe('calibrated');
    expect(read.slots.filter((slot) => slot.slug).length).toBeGreaterThanOrEqual(
      expected.size - 1,
    );
  });

  it('still beats the raw seed layout when portraits sit well off position', () => {
    const { frame, references } = lobby({ offset: { x: 6, y: 5 } });
    const resolved = (profile?: ReturnType<typeof calibrateLayout>['profile']) =>
      readDraft(frame, references, { profile }).slots.filter((slot) => slot.slug).length;
    const { profile } = calibrateLayout(frame, references);
    expect(resolved(profile)).toBeGreaterThan(resolved());
  });

  it('exposes the tile hash and rect for each slot so tiles can be re-cropped', () => {
    const { frame, references } = lobby();
    const slot = readDraft(frame, references).slots[0]!;
    expect(slot.hash).toHaveLength(16);
    expect(slot.color).toHaveLength(96);
    expect(slot.rect.width).toBeGreaterThan(0);
  });

  it('returns every profile region in a stable order', () => {
    const { frame, references } = lobby();
    const profile = seedLayoutProfile(WIDTH, HEIGHT);
    const read = readDraft(frame, references);
    expect(read.slots.map((slot) => slot.key)).toEqual(profile.regions.map((region) => region.key));
  });
});
