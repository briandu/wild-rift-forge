import { describe, expect, it } from 'vitest';
import { createBitmap, setPixel } from './bitmap';
import { drawText, solidBitmap } from './fixtures';
import { hamming } from './hash';
import {
  inferMissingLanes,
  isLockedPick,
  LANE_TEMPLATES,
  mergeRowLanes,
  readLaneLabel,
  readLaneSignature,
  type LaneTemplate,
} from './lanes';

function paintLabel(text: string) {
  const frame = solidBitmap(220, 40, 16, 14, 24);
  drawText(frame, text, 8, 8, 2);
  return frame;
}

const LABEL_RECT = { x: 0, y: 0, width: 1, height: 1 };

describe('inferMissingLanes', () => {
  it('fills the one leftover lane when four rows already named themselves', () => {
    expect(inferMissingLanes(['Mid', 'Jungle', null, 'Dragon', 'Support'])).toEqual([
      'Mid',
      'Jungle',
      'Top',
      'Dragon',
      'Support',
    ]);
  });

  it('leaves holes when more than one lane is unknown', () => {
    expect(inferMissingLanes(['Mid', null, null, 'Dragon', 'Support'])[1]).toBeNull();
  });
});

describe('mergeRowLanes', () => {
  it('keeps a lane learned on an earlier frame', () => {
    const merged = mergeRowLanes(
      ['Mid', 'Jungle', null, 'Dragon', 'Support'],
      [null, 'Jungle', 'Top', null, null],
    );
    expect(merged).toEqual(['Mid', 'Jungle', 'Top', 'Dragon', 'Support']);
  });
});

describe('isLockedPick', () => {
  it('rejects a row that still shows its lane name', () => {
    const bright = createBitmap(32, 32);
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        setPixel(bright, x, y, 200, 180, 90);
      }
    }
    expect(isLockedPick(bright, 'Dragon')).toBe(false);
  });

  it('rejects a dark empty ring even without a lane label', () => {
    const dark = solidBitmap(32, 32, 20, 18, 22);
    expect(isLockedPick(dark, null)).toBe(false);
  });

  it('accepts a bright portrait once the lane label is gone', () => {
    const bright = createBitmap(32, 32);
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        setPixel(bright, x, y, 200, 180, 90);
      }
    }
    expect(isLockedPick(bright, null)).toBe(true);
  });
});

describe('readLaneLabel', () => {
  it('reads painted HUD lane names', () => {
    const samples: Array<[string, LaneTemplate['lane']]> = [
      ['BARON LANE', 'Top'],
      ['JUNGLE', 'Jungle'],
      ['MID LANE', 'Mid'],
      ['DRAGON LANE', 'Dragon'],
      ['SUPPORT', 'Support'],
    ];
    const templates = samples.map(([text, lane]) => {
      const signature = readLaneSignature(paintLabel(text), LABEL_RECT);
      if (!signature) throw new Error(`no signature for ${text}`);
      return { lane, label: text, hash: signature.hash, aspect: signature.aspect };
    });
    for (const [text, lane] of samples) {
      expect(readLaneLabel(paintLabel(text), LABEL_RECT, templates)).toBe(lane);
    }
  });

  it('does not treat a locked champion name as a lane label', () => {
    expect(readLaneLabel(paintLabel('YONE'), LABEL_RECT, LANE_TEMPLATES)).toBeNull();
  });

  it('keeps live lane hashes of different names far apart', () => {
    for (let i = 0; i < LANE_TEMPLATES.length; i += 1) {
      for (let j = i + 1; j < LANE_TEMPLATES.length; j += 1) {
        const left = LANE_TEMPLATES[i]!;
        const right = LANE_TEMPLATES[j]!;
        if (left.lane === right.lane) continue;
        const closeHash = hamming(left.hash, right.hash) <= 12;
        const closeAspect = Math.abs(left.aspect - right.aspect) <= 1.6;
        expect(closeHash && closeAspect).toBe(false);
      }
    }
  });
});
