import { describe, expect, it } from 'vitest';
import { createBitmap, setPixel } from './bitmap';
import { drawText, solidBitmap } from './fixtures';
import { dhash } from './hash';
import { hamming } from './hash';
import {
  detectPhase,
  isAvatarPhase,
  PHASE_TEMPLATES,
  phaseLabel,
  readHudTitle,
  type PhaseTemplate,
} from './phase';

const WIDTH = 800;
const HEIGHT = 450;

function darkFrame(): ReturnType<typeof createBitmap> {
  return solidBitmap(WIDTH, HEIGHT, 16, 14, 24);
}

function paintTitle(text: string, y = 8): ReturnType<typeof createBitmap> {
  const frame = darkFrame();
  const scale = 2;
  const width = text.replace(/[^A-Z!\- ]/gi, ' ').length * 6 * scale;
  const x = Math.round((WIDTH - width) / 2);
  drawText(frame, text, x, y, scale);
  return frame;
}

function templateFor(frame: ReturnType<typeof createBitmap>, phase: PhaseTemplate['phase'], label: string): PhaseTemplate {
  const title = readHudTitle(frame);
  if (!title) throw new Error(`no title isolated for ${label}`);
  return { phase, label, hash: title.hash, aspect: title.aspect };
}

describe('readHudTitle', () => {
  it('isolates the top-centre title and ignores a timer under it', () => {
    const frame = paintTitle('BANNING PHASE', 6);
    // Countdown digits sit under the title the way the live HUD does.
    drawText(frame, '19', 388, 28, 3);
    const title = readHudTitle(frame);
    const withoutTimer = readHudTitle(paintTitle('BANNING PHASE', 6));
    expect(title).not.toBeNull();
    expect(withoutTimer).not.toBeNull();
    expect(title!.hash).toBe(withoutTimer!.hash);
    expect(title!.source).toBe('header');
  });

  it('returns null on an empty lobby', () => {
    expect(readHudTitle(darkFrame())).toBeNull();
  });
});

describe('detectPhase', () => {
  it('reads each painted HUD phrase as its own step', () => {
    const samples: Array<[string, PhaseTemplate['phase']]> = [
      ['YOUR LANE BARON', 'lane'],
      ['PRE-PICK A CHAMPION!', 'pre-pick'],
      ['BANNING PHASE', 'ban'],
      ['BANS', 'ban-reveal'],
      ['YOUR TEAM IS PICKING', 'pick-ally'],
      ['SELECT YOUR CHAMPION!', 'pick-self'],
      ['OPPONENTS PICKING', 'pick-enemy'],
      ['PREPARATION PHASE', 'prep'],
    ];
    const templates = samples.map(([text, phase]) => templateFor(paintTitle(text), phase, text));

    for (const [text, phase] of samples) {
      expect(detectPhase(paintTitle(text), { templates })).toBe(phase);
    }
  });

  it('does not confuse two phrases that share a word', () => {
    const ban = paintTitle('BANNING PHASE');
    const prep = paintTitle('PREPARATION PHASE');
    const templates = [
      templateFor(ban, 'ban', 'BANNING PHASE'),
      templateFor(prep, 'prep', 'PREPARATION PHASE'),
    ];
    expect(detectPhase(ban, { templates })).toBe('ban');
    expect(detectPhase(prep, { templates })).toBe('prep');
  });

  it('calls a very wide header strip the loading screen', () => {
    const frame = darkFrame();
    for (let x = 250; x < 550; x += 1) {
      for (let y = 6; y < 16; y += 1) {
        setPixel(frame, x, y, 230, 230, 230);
      }
    }
    expect(detectPhase(frame)).toBe('loading');
  });

  it('calls a squat header strip the ban-reveal card', () => {
    const frame = darkFrame();
    for (let x = 370; x < 430; x += 1) {
      for (let y = 8; y < 44; y += 1) {
        setPixel(frame, x, y, 230, 230, 230);
      }
    }
    expect(detectPhase(frame)).toBe('ban-reveal');
  });

  it('calls a centre modal with no header match-found', () => {
    const frame = darkFrame();
    drawText(frame, 'MATCH FOUND', 280, 148, 2);
    const title = readHudTitle(frame);
    expect(title?.source).toBe('modal');
    const templates = [templateFor(frame, 'match-found', 'MATCH FOUND')];
    expect(detectPhase(frame, { templates })).toBe('match-found');
  });

  it('reports unknown when nothing readable is on screen', () => {
    expect(detectPhase(darkFrame())).toBe('unknown');
  });
});

describe('phase helpers', () => {
  it('labels phases with the on-screen wording', () => {
    expect(phaseLabel('ban')).toBe('Banning phase');
    expect(phaseLabel('pick-self')).toBe('Select your champion');
  });

  it('treats pre-pick and ban-reveal as avatar steps', () => {
    expect(isAvatarPhase('pre-pick')).toBe(true);
    expect(isAvatarPhase('ban-reveal')).toBe(true);
    expect(isAvatarPhase('pick-self')).toBe(false);
    expect(isAvatarPhase('prep')).toBe(false);
  });

  it('hashes the isolated title without the default portrait inset', () => {
    const frame = paintTitle('BANNING PHASE');
    const title = readHudTitle(frame)!;
    expect(title.hash).toHaveLength(16);
    expect(title.aspect).toBeGreaterThan(3);
    expect(title.hash).not.toBe(dhash(frame));
  });

  it('keeps measured HUD titles far enough apart to not collide', () => {
    for (const left of PHASE_TEMPLATES) {
      for (const right of PHASE_TEMPLATES) {
        if (left === right || left.phase === right.phase) continue;
        if (left.source !== right.source) continue;
        if (Math.abs(left.aspect - right.aspect) > 1.35) continue;
        expect(hamming(left.hash, right.hash), `${left.label} vs ${right.label}`).toBeGreaterThan(12);
      }
    }
  });
});
