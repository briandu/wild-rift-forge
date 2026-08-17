import {
  isAvatarPhase,
  laneIndex,
  mergeRowLanes,
  type DraftLane,
  type DraftPhase,
  type DraftRead,
  type IconReference,
  type LayoutProfile,
  type Rect,
  type SlotRead,
} from '@wild-rift-forge/vision';
import type { IconSignatureDto } from '../api-types';
import { BANS_PER_TEAM, DRAFT_LANES, emptyDraftState, type DraftState } from '../draft-state';

/** Turn the API manifest into the shape the matcher wants. */
export function toIconReferences(signatures: readonly IconSignatureDto[]): IconReference[] {
  return signatures.map((row) => ({
    slug: row.slug,
    hash: row.hash,
    color: row.color ?? undefined,
    variant: row.variant,
  }));
}

/** A slot the user should eyeball before trusting it. */
export type LowConfidenceSlot = {
  key: string;
  role: SlotRead['role'];
  index: number;
  candidate: string | null;
  confidence: number;
};

export type AppliedRead = {
  state: DraftState;
  /** Slots that were resolved, for a "read 7 of 10" style summary. */
  resolved: number;
  review: LowConfidenceSlot[];
  phase: DraftPhase;
  /** Regions actually sampled this frame, including per-frame tray measurement. */
  profile: LayoutProfile;
  contentBounds: Rect;
  sourceWidth: number;
  sourceHeight: number;
};

/** Below this a read is shown to the user for confirmation rather than trusted. */
export const REVIEW_CONFIDENCE = 0.78;

/** A champion can only sit in one slot. Clear every copy before writing a new one. */
function occupy(state: DraftState, slug: string): void {
  for (const team of [state.allies, state.enemies]) {
    for (let index = 0; index < team.length; index += 1) {
      if (team[index]?.slug === slug) team[index] = { ...team[index]!, slug: null };
    }
  }
  for (const pres of [state.allyPrePicks, state.enemyPrePicks]) {
    for (let index = 0; index < pres.length; index += 1) {
      if (pres[index] === slug) pres[index] = null;
    }
  }
  for (const bans of [state.allyBans, state.enemyBans]) {
    for (let index = 0; index < bans.length; index += 1) {
      if (bans[index] === slug) bans[index] = null;
    }
  }
}

function boardIndex(slot: SlotRead, rowLanes: Array<DraftLane | null>): number | null {
  if (slot.role === 'ally') {
    const lane = slot.lane ?? rowLanes[slot.index] ?? null;
    if (lane) {
      const index = laneIndex(lane);
      return index >= 0 ? index : null;
    }
  }
  if (slot.index < 0 || slot.index >= DRAFT_LANES.length) return null;
  return slot.index;
}

/**
 * Merge a capture into the board.
 *
 * Existing picks are kept where the capture saw nothing, so a partial read never
 * wipes work the user already did by hand. Pre-picks stay off the board — the
 * HUD still shows the lane name and a darkened portrait until the player locks.
 * A later frame that recognises the same champion as a pre-pick also clears it,
 * so a hover that landed on the wrong lane does not stick. Bans are always
 * applied, including during the ban phase.
 */
function emptyRowSlugs(): Array<string | null> {
  return Array.from({ length: DRAFT_LANES.length }, () => null);
}

export function applyRead(read: DraftRead, previous?: DraftState): AppliedRead {
  const state: DraftState = previous
    ? {
        ...previous,
        allies: previous.allies.map((slot) => ({ ...slot })),
        enemies: previous.enemies.map((slot) => ({ ...slot })),
        allyBans: [...previous.allyBans],
        enemyBans: [...previous.enemyBans],
        allyRowLanes: [...previous.allyRowLanes],
        allyPrePicks: [...(previous.allyPrePicks ?? emptyRowSlugs())],
        enemyPrePicks: [...(previous.enemyPrePicks ?? emptyRowSlugs())],
        overrides: { ...previous.overrides },
        cleared: { ...previous.cleared },
      }
    : emptyDraftState();

  state.allyRowLanes = mergeRowLanes(state.allyRowLanes, read.rowLanes ?? []);
  const trustRows = !isAvatarPhase(read.phase);
  let resolved = 0;
  const review: LowConfidenceSlot[] = [];

  for (const slot of read.slots) {
    const isRow = slot.role === 'ally' || slot.role === 'enemy';
    if (isRow && !trustRows) continue;
    if (isRow && slot.locked === false) {
      const guessed = slot.slug ?? (slot.confidence > 0.4 ? slot.candidate : null);
      const index = boardIndex(slot, state.allyRowLanes);
      if (guessed) {
        const team = slot.role === 'ally' ? state.allies : state.enemies;
        for (let i = 0; i < team.length; i += 1) {
          if (team[i]?.slug === guessed) {
            team[i] = { ...team[i]!, slug: null };
          }
        }
        if (index !== null) {
          const key = `${slot.role}-${index}`;
          if (!state.overrides[key] && state.cleared[key] !== guessed) {
            const pres = slot.role === 'ally' ? state.allyPrePicks : state.enemyPrePicks;
            pres[index] = guessed;
          }
        }
      }
      continue;
    }
    if (!isRow && slot.index >= BANS_PER_TEAM) continue;

    const index = isRow ? boardIndex(slot, state.allyRowLanes) : slot.index;
    if (index === null) continue;
    if (isRow && index >= DRAFT_LANES.length) continue;

    const writeKey =
      slot.role === 'ban-ally' || slot.role === 'ban-enemy'
        ? slot.key
        : `${slot.role}-${index}`;
    if (state.overrides[writeKey]) continue;
    if (slot.slug && state.cleared[writeKey] === slot.slug) continue;

    if (!slot.slug) {
      // A ⃠ tile is a real read of "nothing here". Keeping the previous guess is
      // how a skipped enemy ban became Sivir and how Mordekaiser appeared twice.
      if ((slot.role === 'ban-ally' || slot.role === 'ban-enemy') && slot.empty) {
        state[slot.role === 'ban-ally' ? 'allyBans' : 'enemyBans'][index] = null;
      } else if (slot.candidate && slot.confidence > 0.4 && slot.locked !== false) {
        review.push({
          key: slot.key,
          role: slot.role,
          index,
          candidate: slot.candidate,
          confidence: slot.confidence,
        });
      }
      continue;
    }

    if (slot.confidence < REVIEW_CONFIDENCE) {
      review.push({
        key: slot.key,
        role: slot.role,
        index,
        candidate: slot.slug,
        confidence: slot.confidence,
      });
      // A weak ban guess is how Mel became Samira and Mordekaiser became
      // Hecarim. Leave the slot pending rather than painting the wrong icon.
      if (slot.role === 'ban-ally' || slot.role === 'ban-enemy') continue;
    }

    resolved += 1;
    occupy(state, slot.slug);
    delete state.cleared[writeKey];
    switch (slot.role) {
      case 'ally':
        state.allies[index] = { ...state.allies[index]!, slug: slot.slug };
        state.allyPrePicks[index] = null;
        break;
      case 'enemy':
        state.enemies[index] = { ...state.enemies[index]!, slug: slot.slug };
        state.enemyPrePicks[index] = null;
        break;
      case 'ban-ally':
        state.allyBans[index] = slot.slug;
        break;
      case 'ban-enemy':
        state.enemyBans[index] = slot.slug;
        break;
    }
  }

  if (read.mySlotIndex !== null && read.mySlotIndex < DRAFT_LANES.length) {
    const named = state.allyRowLanes[read.mySlotIndex];
    if (named) {
      const index = laneIndex(named);
      if (index >= 0) state.mySlotIndex = index;
    } else if (trustRows) {
      state.mySlotIndex = read.mySlotIndex;
    }
  }

  return {
    state,
    resolved,
    review,
    phase: read.phase,
    profile: read.profile,
    contentBounds: read.contentBounds,
    sourceWidth: read.sourceWidth,
    sourceHeight: read.sourceHeight,
  };
}
