import { describe, expect, it } from 'vitest';
import {
  bannedSlugs,
  BANS_PER_TEAM,
  DRAFT_LANES,
  emptyDraftState,
  isDraftEmpty,
  parseDraftState,
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

  it('keeps lanes canonical even if stored lanes were tampered with', () => {
    const state = emptyDraftState();
    const tampered = {
      ...state,
      allies: state.allies.map((slot) => ({ ...slot, lane: 'Bogus' })),
    };
    expect(parseDraftState(JSON.stringify(tampered))?.allies[0]?.lane).toBe('Top');
  });
});
