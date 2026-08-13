import type { DraftRead, IconReference, SlotRead } from '@wild-rift-forge/vision';
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
};

/** Below this a read is shown to the user for confirmation rather than trusted. */
export const REVIEW_CONFIDENCE = 0.78;

/**
 * Merge a capture into the board.
 *
 * Existing picks are kept where the capture saw nothing, so a partial read never
 * wipes work the user already did by hand. During the ban phase the ally column
 * shows account avatars rather than picks, so those rows are ignored outright.
 */
export function applyRead(read: DraftRead, previous?: DraftState): AppliedRead {
  const state: DraftState = previous
    ? {
        ...previous,
        allies: previous.allies.map((slot) => ({ ...slot })),
        enemies: previous.enemies.map((slot) => ({ ...slot })),
        allyBans: [...previous.allyBans],
        enemyBans: [...previous.enemyBans],
      }
    : emptyDraftState();

  const trustRows = read.phase !== 'ban';
  let resolved = 0;
  const review: LowConfidenceSlot[] = [];

  for (const slot of read.slots) {
    const isRow = slot.role === 'ally' || slot.role === 'enemy';
    if (isRow && !trustRows) continue;
    if (isRow && slot.index >= DRAFT_LANES.length) continue;
    if (!isRow && slot.index >= BANS_PER_TEAM) continue;

    if (!slot.slug) {
      // A confident-looking miss is worth surfacing; an empty ring is not.
      if (slot.candidate && slot.confidence > 0.4) {
        review.push({
          key: slot.key,
          role: slot.role,
          index: slot.index,
          candidate: slot.candidate,
          confidence: slot.confidence,
        });
      }
      continue;
    }

    resolved += 1;
    if (slot.confidence < REVIEW_CONFIDENCE) {
      review.push({
        key: slot.key,
        role: slot.role,
        index: slot.index,
        candidate: slot.slug,
        confidence: slot.confidence,
      });
    }

    switch (slot.role) {
      case 'ally':
        state.allies[slot.index] = { ...state.allies[slot.index]!, slug: slot.slug };
        break;
      case 'enemy':
        state.enemies[slot.index] = { ...state.enemies[slot.index]!, slug: slot.slug };
        break;
      case 'ban-ally':
        state.allyBans[slot.index] = slot.slug;
        break;
      case 'ban-enemy':
        state.enemyBans[slot.index] = slot.slug;
        break;
    }
  }

  if (trustRows && read.mySlotIndex !== null && read.mySlotIndex < DRAFT_LANES.length) {
    state.mySlotIndex = read.mySlotIndex;
  }

  return { state, resolved, review };
}
