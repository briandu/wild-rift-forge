import { describe, expect, it } from 'vitest';
import type { DraftPhase, DraftRead, SlotRead } from '@wild-rift-forge/vision';
import { emptyDraftState } from '../draft-state';
import { applyRead, REVIEW_CONFIDENCE, toIconReferences } from './to-draft-state';

function slot(partial: Partial<SlotRead> & Pick<SlotRead, 'key' | 'role' | 'index'>): SlotRead {
  return {
    slug: null,
    candidate: null,
    confidence: 0,
    lane: null,
    locked: true,
    empty: false,
    rect: { x: 0, y: 0, width: 10, height: 10 },
    hash: '0000000000000000',
    color: '0'.repeat(96),
    ...partial,
  };
}

function read(slots: SlotRead[], extra: Partial<DraftRead> = {}): DraftRead {
  return {
    slots,
    mySlotIndex: null,
    rowLanes: [],
    phase: 'pick' as DraftPhase,
    profile: {
      aspectKey: '16:9',
      regions: [],
      highlightRegions: [],
      laneLabelRegions: [],
      source: 'seed',
    },
    contentBounds: { x: 0, y: 0, width: 100, height: 100 },
    frame: { width: 100, height: 100, data: new Uint8ClampedArray(4) },
    sourceWidth: 100,
    sourceHeight: 100,
    ...extra,
  } as DraftRead;
}

describe('toIconReferences', () => {
  it('maps the API manifest onto matcher references', () => {
    const references = toIconReferences([
      { slug: 'ahri', variant: 'thumb', hash: 'a'.repeat(16), color: 'b'.repeat(96) },
      { slug: 'garen', variant: 'captured', hash: 'c'.repeat(16), color: null },
    ]);
    expect(references[0]).toEqual({
      slug: 'ahri',
      hash: 'a'.repeat(16),
      color: 'b'.repeat(96),
      variant: 'thumb',
    });
    expect(references[1]?.color).toBeUndefined();
    expect(references[1]?.variant).toBe('captured');
  });
});

describe('applyRead', () => {
  it('fills picks and bans from a confident read', () => {
    const applied = applyRead(
      read([
        slot({ key: 'ally-0', role: 'ally', index: 0, slug: 'garen', confidence: 0.95 }),
        slot({ key: 'enemy-2', role: 'enemy', index: 2, slug: 'ahri', confidence: 0.93 }),
        slot({ key: 'ban-ally-1', role: 'ban-ally', index: 1, slug: 'gwen', confidence: 0.9 }),
        slot({ key: 'ban-enemy-0', role: 'ban-enemy', index: 0, slug: 'zed', confidence: 0.91 }),
      ]),
    );
    expect(applied.state.allies[0]?.slug).toBe('garen');
    expect(applied.state.enemies[2]?.slug).toBe('ahri');
    expect(applied.state.allyBans[1]).toBe('gwen');
    expect(applied.state.enemyBans[0]).toBe('zed');
    expect(applied.resolved).toBe(4);
    expect(applied.review).toHaveLength(0);
  });

  it('keeps a lane the user already filled when the capture saw nothing there', () => {
    const previous = emptyDraftState();
    previous.allies[3] = { lane: 'Dragon', slug: 'jinx' };
    const applied = applyRead(
      read([slot({ key: 'ally-0', role: 'ally', index: 0, slug: 'garen', confidence: 0.95 })]),
      previous,
    );
    expect(applied.state.allies[3]?.slug).toBe('jinx');
    expect(applied.state.allies[0]?.slug).toBe('garen');
  });

  it('does not mutate the state it was given', () => {
    const previous = emptyDraftState();
    applyRead(
      read([slot({ key: 'ally-0', role: 'ally', index: 0, slug: 'garen', confidence: 0.95 })]),
      previous,
    );
    expect(previous.allies[0]?.slug).toBeNull();
  });

  it('flags a resolved but shaky slot for review', () => {
    const applied = applyRead(
      read([
        slot({
          key: 'enemy-0',
          role: 'enemy',
          index: 0,
          slug: 'ahri',
          confidence: REVIEW_CONFIDENCE - 0.1,
        }),
      ]),
    );
    expect(applied.state.enemies[0]?.slug).toBe('ahri');
    expect(applied.review).toHaveLength(1);
    expect(applied.review[0]?.candidate).toBe('ahri');
  });

  it('flags a near-miss so the user can accept the runner-up', () => {
    const applied = applyRead(
      read([slot({ key: 'enemy-1', role: 'enemy', index: 1, candidate: 'zed', confidence: 0.5 })]),
    );
    expect(applied.state.enemies[1]?.slug).toBeNull();
    expect(applied.review[0]?.candidate).toBe('zed');
    expect(applied.resolved).toBe(0);
  });

  it('ignores an empty ring rather than asking about it', () => {
    const applied = applyRead(
      read([slot({ key: 'enemy-4', role: 'enemy', index: 4, candidate: 'zed', confidence: 0.1 })]),
    );
    expect(applied.review).toHaveLength(0);
  });

  it('ignores player rows during pre-pick, where they are still avatars', () => {
    const applied = applyRead(
      read(
        [
          slot({ key: 'ally-0', role: 'ally', index: 0, slug: 'garen', confidence: 0.99 }),
          slot({ key: 'ban-enemy-0', role: 'ban-enemy', index: 0, slug: 'zed', confidence: 0.99 }),
        ],
        { phase: 'pre-pick' },
      ),
    );
    expect(applied.state.allies[0]?.slug).toBeNull();
    expect(applied.state.enemyBans[0]).toBe('zed');
    expect(applied.phase).toBe('pre-pick');
  });

  it('ignores player rows during the ban phase, where they are account avatars', () => {
    const applied = applyRead(
      read(
        [
          slot({ key: 'ally-0', role: 'ally', index: 0, slug: 'garen', confidence: 0.99 }),
          slot({ key: 'ban-enemy-0', role: 'ban-enemy', index: 0, slug: 'zed', confidence: 0.99 }),
        ],
        { phase: 'ban' },
      ),
    );
    expect(applied.state.allies[0]?.slug).toBeNull();
    expect(applied.state.enemyBans[0]).toBe('zed');
    expect(applied.resolved).toBe(1);
  });

  it('maps a visual row onto the named lane, not pick-order index', () => {
    const applied = applyRead(
      read([slot({ key: 'ally-0', role: 'ally', index: 0, slug: 'yone', confidence: 0.95, lane: 'Mid' })]),
    );
    expect(applied.state.allies[2]?.slug).toBe('yone');
    expect(applied.state.allies[2]?.lane).toBe('Mid');
    expect(applied.state.allies[0]?.slug).toBeNull();
  });

  it('keeps a darkened pre-pick off the locked board', () => {
    const applied = applyRead(
      read([
        slot({
          key: 'ally-3',
          role: 'ally',
          index: 3,
          slug: 'leesin',
          confidence: 0.99,
          lane: 'Dragon',
          locked: false,
        }),
      ]),
    );
    expect(applied.state.allies[3]?.slug).toBeNull();
    expect(applied.state.allyPrePicks[3]).toBe('leesin');
    expect(applied.resolved).toBe(0);
  });

  it('clears a pre-pick that an earlier read had dropped on the wrong lane', () => {
    const previous = emptyDraftState();
    previous.allies[3] = { lane: 'Dragon', slug: 'leesin' };
    const applied = applyRead(
      read([
        slot({
          key: 'ally-3',
          role: 'ally',
          index: 3,
          slug: 'leesin',
          confidence: 0.99,
          lane: 'Jungle',
          locked: false,
        }),
      ]),
      previous,
    );
    expect(applied.state.allies[3]?.slug).toBeNull();
  });

  it('leaves a weak ban pending instead of painting the wrong champion', () => {
    const applied = applyRead(
      read([
        slot({
          key: 'ban-ally-1',
          role: 'ban-ally',
          index: 1,
          slug: 'samira',
          confidence: REVIEW_CONFIDENCE - 0.1,
        }),
      ]),
    );
    expect(applied.state.allyBans[1]).toBeNull();
    expect(applied.review).toHaveLength(1);
    expect(applied.review[0]?.candidate).toBe('samira');
    expect(applied.resolved).toBe(0);
  });

  it('still writes bans during the ban phase', () => {
    const applied = applyRead(
      read(
        [slot({ key: 'ban-ally-0', role: 'ban-ally', index: 0, slug: 'seraphine', confidence: 0.94 })],
        { phase: 'ban' },
      ),
    );
    expect(applied.state.allyBans[0]).toBe('seraphine');
    expect(applied.resolved).toBe(1);
  });

  it('maps the highlighted visual row onto the named lane', () => {
    const applied = applyRead(
      read([], {
        mySlotIndex: 2,
        rowLanes: ['Mid', 'Jungle', 'Top', 'Dragon', 'Support'],
      }),
    );
    expect(applied.state.mySlotIndex).toBe(0);
    expect(applied.state.allyRowLanes[2]).toBe('Top');
  });

  it('adopts a raw highlight only during pick, when no lane label was read', () => {
    const picked = applyRead(read([], { mySlotIndex: 3 }));
    expect(picked.state.mySlotIndex).toBe(3);
    const banned = applyRead(read([], { mySlotIndex: 3, phase: 'ban' }));
    expect(banned.state.mySlotIndex).toBe(0);
  });

  it('keeps a ban when this frame cannot read that slot', () => {
    const previous = emptyDraftState();
    previous.allyBans[2] = 'samira';
    const applied = applyRead(
      read([slot({ key: 'ban-ally-2', role: 'ban-ally', index: 2 })]),
      previous,
    );
    expect(applied.state.allyBans[2]).toBe('samira');
  });

  it('clears a ban the camera now reads as empty', () => {
    const previous = emptyDraftState();
    previous.enemyBans[3] = 'sivir';
    const applied = applyRead(
      read([slot({ key: 'ban-enemy-3', role: 'ban-enemy', index: 3, empty: true })]),
      previous,
    );
    expect(applied.state.enemyBans[3]).toBeNull();
  });

  it('will not leave the same champion in two ban slots', () => {
    const previous = emptyDraftState();
    previous.allyBans[4] = 'mordekaiser';
    const applied = applyRead(
      read([
        slot({
          key: 'ban-ally-3',
          role: 'ban-ally',
          index: 3,
          slug: 'mordekaiser',
          confidence: 0.92,
        }),
      ]),
      previous,
    );
    expect(applied.state.allyBans[3]).toBe('mordekaiser');
    expect(applied.state.allyBans[4]).toBeNull();
  });

  it('does not overwrite a slot the user set by hand', () => {
    const previous = emptyDraftState();
    previous.overrides['ally-0'] = 'renekton';
    previous.allies[0] = { lane: 'Top', slug: 'renekton' };
    const applied = applyRead(
      read([slot({ key: 'ally-0', role: 'ally', index: 0, slug: 'garen', confidence: 0.99 })]),
      previous,
    );
    expect(applied.state.allies[0]?.slug).toBe('renekton');
  });

  it('does not put back a champion the user just cleared', () => {
    const previous = emptyDraftState();
    previous.cleared['enemy-0'] = 'riven';
    const applied = applyRead(
      read([slot({ key: 'enemy-0', role: 'enemy', index: 0, slug: 'riven', confidence: 0.99 })]),
      previous,
    );
    expect(applied.state.enemies[0]?.slug).toBeNull();
  });

  it('drops slots outside the board rather than growing it', () => {
    const applied = applyRead(
      read([
        slot({ key: 'ally-9', role: 'ally', index: 9, slug: 'garen', confidence: 0.99 }),
        slot({ key: 'ban-ally-9', role: 'ban-ally', index: 9, slug: 'zed', confidence: 0.99 }),
      ]),
    );
    expect(applied.state.allies).toHaveLength(5);
    expect(applied.state.allyBans).toHaveLength(5);
    expect(applied.resolved).toBe(0);
  });
});
