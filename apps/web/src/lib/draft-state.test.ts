import { describe, expect, it } from 'vitest';
import {
  allySlotsInPickOrder,
  enemySlotsInPickOrder,
  bannedSlugs,
  BANS_PER_TEAM,
  clearSlot,
  DRAFT_LANES,
  emptyDraftState,
  isDraftEmpty,
  parseDraftState,
  setOverride,
  slotView,
  takenSlugs,
} from './draft-state';

describe('emptyDraftState', () => {
  it('creates one slot per lane and a ban tray per team', () => {
    const state = emptyDraftState();
    expect(state.allies).toHaveLength(DRAFT_LANES.length);
    expect(state.enemies).toHaveLength(DRAFT_LANES.length);
    expect(state.allyBans).toHaveLength(BANS_PER_TEAM);
    expect(state.enemyBans).toHaveLength(BANS_PER_TEAM);
    expect(isDraftEmpty(state)).toBe(true);
  });
});

describe('allySlotsInPickOrder', () => {
  it('keeps Baron→Support until every visual row has a lane', () => {
    const state = emptyDraftState();
    state.allyRowLanes = ['Mid', 'Jungle', null, 'Dragon', 'Support'];
    expect(allySlotsInPickOrder(state).map((slot) => slot.lane)).toEqual([...DRAFT_LANES]);
  });

  it('follows the captured pick order once all five lanes are named', () => {
    const state = emptyDraftState();
    state.allies[2] = { lane: 'Mid', slug: 'yone' };
    state.allyRowLanes = ['Mid', 'Jungle', 'Top', 'Dragon', 'Support'];
    const ordered = allySlotsInPickOrder(state);
    expect(ordered.map((slot) => slot.lane)).toEqual(['Mid', 'Jungle', 'Top', 'Dragon', 'Support']);
    expect(ordered[0]?.slug).toBe('yone');
    expect(ordered[0]?.boardIndex).toBe(2);
  });
});

describe('enemySlotsInPickOrder', () => {
  it('relabels enemy rows with the captured pick order', () => {
    const state = emptyDraftState();
    state.enemies[0] = { lane: 'Top', slug: 'ryze' };
    state.allyRowLanes = ['Mid', 'Jungle', 'Top', 'Dragon', 'Support'];
    const ordered = enemySlotsInPickOrder(state);
    expect(ordered.map((slot) => slot.lane)).toEqual(['Mid', 'Jungle', 'Top', 'Dragon', 'Support']);
    expect(ordered[0]?.slug).toBe('ryze');
    expect(ordered[0]?.boardIndex).toBe(0);
  });
});

describe('takenSlugs', () => {
  it('collects picks from both teams plus both ban trays', () => {
    const state = emptyDraftState();
    state.allies[0] = { lane: 'Top', slug: 'garen' };
    state.enemies[2] = { lane: 'Mid', slug: 'ahri' };
    state.allyBans[1] = 'gwen';
    state.enemyBans[0] = 'yasuo';
    expect(takenSlugs(state)).toEqual(new Set(['garen', 'ahri', 'gwen', 'yasuo']));
    expect(bannedSlugs(state)).toEqual(new Set(['gwen', 'yasuo']));
    expect(isDraftEmpty(state)).toBe(false);
  });

  it('counts a ban alone as a non-empty board', () => {
    const state = emptyDraftState();
    state.enemyBans[4] = 'teemo';
    expect(isDraftEmpty(state)).toBe(false);
  });
});

describe('parseDraftState', () => {
  it('round-trips a valid state', () => {
    const state = emptyDraftState();
    state.allies[1] = { lane: 'Jungle', slug: 'leesin' };
    state.allyBans[0] = 'yasuo';
    state.enemyBans[2] = 'zed';
    state.mySlotIndex = 3;
    expect(parseDraftState(JSON.stringify(state))).toEqual(state);
  });

  it('rejects malformed input rather than half-parsing it', () => {
    expect(parseDraftState('not json')).toBeNull();
    expect(parseDraftState('{}')).toBeNull();
    expect(parseDraftState(JSON.stringify({ allies: [], enemies: [] }))).toBeNull();
  });

  it('repairs out-of-range slot ownership and short ban lists', () => {
    const state = emptyDraftState();
    const parsed = parseDraftState(
      JSON.stringify({ ...state, mySlotIndex: 99, allyBans: ['gwen'] }),
    );
    expect(parsed?.mySlotIndex).toBe(0);
    expect(parsed?.allyBans).toHaveLength(BANS_PER_TEAM);
    expect(parsed?.allyBans[0]).toBe('gwen');
    expect(parsed?.allyBans[1]).toBeNull();
  });

  it('round-trips pre-picks, overrides and the start clock', () => {
    const state = emptyDraftState();
    state.allyPrePicks[0] = 'volibear';
    state.overrides['enemy-1'] = 'ahri';
    state.startedAt = 1_700_000_000_000;
    expect(parseDraftState(JSON.stringify(state))).toEqual(state);
  });

  it('keeps lanes canonical even if stored lanes were tampered with', () => {
    const state = emptyDraftState();
    const tampered = {
      ...state,
      allies: state.allies.map((slot) => ({ ...slot, lane: 'Bogus' })),
    };
    expect(parseDraftState(JSON.stringify(tampered))?.allies[0]?.lane).toBe('Top');
  });
});

describe('slotView / clearSlot / setOverride', () => {
  it('prefers a manual override over a locked or pre-picked slug', () => {
    const state = emptyDraftState();
    state.allies[0] = { lane: 'Top', slug: 'garen' };
    state.allyPrePicks[0] = 'volibear';
    expect(slotView(state, 'ally', 0)).toEqual({ slug: 'garen', isPre: false, isManual: false });
    const overridden = setOverride(state, 'ally-0', 'renekton');
    expect(slotView(overridden, 'ally', 0)).toEqual({
      slug: 'renekton',
      isPre: false,
      isManual: true,
    });
  });

  it('clears a slot so a later capture of the same champ cannot refill it', () => {
    const state = emptyDraftState();
    state.enemies[1] = { lane: 'Jungle', slug: 'riven' };
    const cleared = clearSlot(state, 'enemy-1');
    expect(cleared.enemies[1]?.slug).toBeNull();
    expect(cleared.cleared['enemy-1']).toBe('riven');
    expect(slotView(cleared, 'enemy', 1).slug).toBeNull();
  });
});
