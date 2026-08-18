import type { TierLane } from '@wild-rift-forge/game-data';
import type { DraftPhase } from '@wild-rift-forge/vision';
import type { TierPlacementDto } from './api-types';
import { DRAFT_LANES, type DraftState } from './draft-state';

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function lockedPickCount(state: DraftState): number {
  return (
    state.allies.filter((slot) => Boolean(slot.slug)).length +
    state.enemies.filter((slot) => Boolean(slot.slug)).length
  );
}

export type PhaseChrome = {
  badge: string;
  name: string;
  color: string;
  background: string;
  border: string;
};

const YOUR_TURN: PhaseChrome = {
  badge: '',
  name: '',
  color: '#F0A87B',
  background: 'rgba(240,168,123,.14)',
  border: 'rgba(240,168,123,.38)',
};

const CALM: PhaseChrome = {
  badge: '',
  name: '',
  color: '#9FCBE4',
  background: 'rgba(159,203,228,.12)',
  border: 'rgba(159,203,228,.34)',
};

/**
 * HUD chrome for the captured champion-select step.
 * Pick count is locked portraits only — pre-picks do not advance the badge.
 */
export function phaseChrome(phase: DraftPhase | null, locked: number): PhaseChrome {
  const of = `${Math.min(locked, 10)} OF 10`;
  if (phase === 'pick-self') {
    return {
      ...YOUR_TURN,
      badge: `PICK ${of} · YOUR TURN`,
      name: 'Pick phase · you are on the clock',
    };
  }
  if (phase === 'pick-ally' || phase === 'pick' || phase === 'pick-enemy') {
    return {
      ...CALM,
      badge: `PICK ${of}`,
      name: phase === 'pick-enemy' ? 'Opponents picking' : 'Pick phase',
    };
  }
  if (phase === 'ban' || phase === 'ban-reveal') {
    return { ...YOUR_TURN, badge: phase === 'ban-reveal' ? 'BANS' : 'BANNING', name: 'Banning phase' };
  }
  if (phase === 'pre-pick') {
    return { ...CALM, badge: 'PRE-PICK', name: 'Pre-pick a champion' };
  }
  if (phase === 'prep') {
    return { ...CALM, badge: 'PREPARATION', name: 'Preparation phase' };
  }
  if (phase === 'lane') {
    return { ...CALM, badge: 'YOUR LANE', name: 'Choose a lane' };
  }
  if (phase === 'match-found') {
    return { ...CALM, badge: 'MATCH FOUND', name: 'Match found' };
  }
  if (phase === 'loading') {
    return { ...CALM, badge: 'LOADING', name: 'Loading' };
  }
  return {
    ...CALM,
    badge: locked > 0 ? `PICK ${of}` : 'WAITING',
    name: 'Champion select',
  };
}

/** Typical remaining time for a step, used until the HUD timer can be read. */
export const PHASE_BUDGET: Partial<Record<DraftPhase, number>> = {
  'pick-self': 30,
  'pick-ally': 30,
  'pick-enemy': 30,
  pick: 30,
  ban: 30,
  'pre-pick': 30,
  prep: 30,
  lane: 20,
};

export type LaneGuess = {
  lane: TierLane;
  pct: number;
};

/**
 * Where an enemy pick is likely going. Champion select hides their roles, so
 * this is the champion's lane mix from the current tier snapshot — pick rate
 * first, score when pick rate is missing.
 */
export function guessChampionLanes(
  slug: string | null,
  placements: readonly TierPlacementDto[],
): LaneGuess[] {
  if (!slug) return [];
  const rows = placements.filter((row) => row.slug === slug);
  if (!rows.length) return [];
  const weights = rows.map((row) => ({
    lane: row.lane,
    weight: row.pickRate > 0 ? row.pickRate : Math.max(row.score, 1),
  }));
  const total = weights.reduce((sum, row) => sum + row.weight, 0);
  if (total <= 0) return [];
  const raw = weights
    .map((row) => ({ lane: row.lane, pct: Math.round((row.weight / total) * 100) }))
    .sort((a, b) => b.pct - a.pct || DRAFT_LANES.indexOf(a.lane) - DRAFT_LANES.indexOf(b.lane));
  const drift = 100 - raw.reduce((sum, row) => sum + row.pct, 0);
  if (raw[0]) raw[0] = { ...raw[0], pct: raw[0].pct + drift };
  return raw.filter((row) => row.pct > 0);
}

export function isFlexPick(guesses: readonly LaneGuess[]): boolean {
  return guesses.length > 1 && (guesses[0]?.pct ?? 100) < 80;
}

export function firstPickKnown(state: DraftState): boolean {
  return (
    state.allyRowLanes.length === DRAFT_LANES.length &&
    state.allyRowLanes.every((lane): lane is TierLane => Boolean(lane)) &&
    new Set(state.allyRowLanes).size === DRAFT_LANES.length
  );
}
