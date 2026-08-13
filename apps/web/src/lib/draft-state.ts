import type { TierLane } from '@wild-rift-forge/game-data';
import { BANS_PER_TEAM } from '@wild-rift-forge/vision';

export const DRAFT_LANES: readonly TierLane[] = ['Top', 'Jungle', 'Mid', 'Dragon', 'Support'];

export { BANS_PER_TEAM };

export type DraftSlot = { lane: TierLane; slug: string | null };

export type DraftState = {
  allies: DraftSlot[];
  enemies: DraftSlot[];
  /** Champions your team removed from the pool. */
  allyBans: Array<string | null>;
  /** Champions the enemy team removed from the pool. */
  enemyBans: Array<string | null>;
  /** Which ally slot the user is drafting for. */
  mySlotIndex: number;
};

/** Bumped whenever the persisted shape changes, so stale entries are dropped. */
const STORAGE_KEY = 'wrf.draft.v2';

function emptyBans(): Array<string | null> {
  return Array.from({ length: BANS_PER_TEAM }, () => null);
}

export function emptyDraftState(): DraftState {
  return {
    allies: DRAFT_LANES.map((lane) => ({ lane, slug: null })),
    enemies: DRAFT_LANES.map((lane) => ({ lane, slug: null })),
    allyBans: emptyBans(),
    enemyBans: emptyBans(),
    mySlotIndex: 0,
  };
}

export function isDraftEmpty(state: DraftState): boolean {
  return (
    state.allies.every((slot) => !slot.slug) &&
    state.enemies.every((slot) => !slot.slug) &&
    state.allyBans.every((slug) => !slug) &&
    state.enemyBans.every((slug) => !slug)
  );
}

/** Everything unavailable to pick: both teams' picks plus every ban. */
export function takenSlugs(state: DraftState): Set<string> {
  const taken = new Set<string>();
  for (const slot of [...state.allies, ...state.enemies]) {
    if (slot.slug) taken.add(slot.slug);
  }
  for (const slug of [...state.allyBans, ...state.enemyBans]) {
    if (slug) taken.add(slug);
  }
  return taken;
}

export function bannedSlugs(state: DraftState): Set<string> {
  return new Set(
    [...state.allyBans, ...state.enemyBans].filter((slug): slug is string => Boolean(slug)),
  );
}

function parseSlots(value: unknown): DraftSlot[] | null {
  if (!Array.isArray(value) || value.length !== DRAFT_LANES.length) return null;
  const slots: DraftSlot[] = [];
  for (let index = 0; index < DRAFT_LANES.length; index += 1) {
    const raw = value[index] as { slug?: unknown } | null;
    if (!raw || typeof raw !== 'object') return null;
    const slug = typeof raw.slug === 'string' && raw.slug ? raw.slug : null;
    slots.push({ lane: DRAFT_LANES[index]!, slug });
  }
  return slots;
}

function parseBans(value: unknown): Array<string | null> {
  return Array.from({ length: BANS_PER_TEAM }, (_, index) => {
    const slug = Array.isArray(value) ? value[index] : null;
    return typeof slug === 'string' && slug ? slug : null;
  });
}

/**
 * Rebuild state from an untrusted string. Anything malformed yields null so the
 * caller falls back to an empty board rather than rendering a half-parsed lobby.
 */
export function parseDraftState(raw: string): DraftState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    const allies = parseSlots(parsed.allies);
    const enemies = parseSlots(parsed.enemies);
    if (!allies || !enemies) return null;
    const mySlotIndex =
      typeof parsed.mySlotIndex === 'number' &&
      parsed.mySlotIndex >= 0 &&
      parsed.mySlotIndex < DRAFT_LANES.length
        ? parsed.mySlotIndex
        : 0;
    return {
      allies,
      enemies,
      allyBans: parseBans(parsed.allyBans),
      enemyBans: parseBans(parsed.enemyBans),
      mySlotIndex,
    };
  } catch {
    return null;
  }
}

export function loadDraftState(): DraftState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseDraftState(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraftState(state: DraftState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing and full quotas both throw here; losing persistence is fine.
  }
}

export function clearDraftState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See saveDraftState.
  }
}
