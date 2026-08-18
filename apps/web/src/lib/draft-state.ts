import type { TierLane } from '@wild-rift-forge/game-data';
import { BANS_PER_TEAM, type DraftLane } from '@wild-rift-forge/vision';

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
  /**
   * Visual ally rows (pick order) mapped onto board lanes.
   * Ranked lists Mid first when they have first pick; the board stays Baron→Support.
   */
  allyRowLanes: Array<DraftLane | null>;
  /** Hovered / hovered-in portraits that are not locked yet. */
  allyPrePicks: Array<string | null>;
  enemyPrePicks: Array<string | null>;
  /** Manual fixes keyed by vision slot key (`ally-0`, `enemy-2`, `ban-ally-1`). */
  overrides: Record<string, string>;
  /** Slug the user cleared from a slot, so a stale capture cannot put it back. */
  cleared: Record<string, string>;
  /** Epoch ms when this lobby started, for the elapsed clock. */
  startedAt: number | null;
};

/** Bumped whenever the persisted shape changes, so stale entries are dropped. */
const STORAGE_KEY = 'wrf.draft.v7';

function emptyBans(): Array<string | null> {
  return Array.from({ length: BANS_PER_TEAM }, () => null);
}

function emptyRowSlugs(): Array<string | null> {
  return Array.from({ length: DRAFT_LANES.length }, () => null);
}

export function emptyDraftState(): DraftState {
  return {
    allies: DRAFT_LANES.map((lane) => ({ lane, slug: null })),
    enemies: DRAFT_LANES.map((lane) => ({ lane, slug: null })),
    allyBans: emptyBans(),
    enemyBans: emptyBans(),
    mySlotIndex: 0,
    allyRowLanes: DRAFT_LANES.map(() => null),
    allyPrePicks: emptyRowSlugs(),
    enemyPrePicks: emptyRowSlugs(),
    overrides: {},
    cleared: {},
    startedAt: null,
  };
}

export function isDraftEmpty(state: DraftState): boolean {
  return (
    state.allies.every((slot) => !slot.slug) &&
    state.enemies.every((slot) => !slot.slug) &&
    state.allyBans.every((slug) => !slug) &&
    state.enemyBans.every((slug) => !slug) &&
    state.allyPrePicks.every((slug) => !slug) &&
    state.enemyPrePicks.every((slug) => !slug) &&
    Object.keys(state.overrides).length === 0
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

export type OrderedDraftSlot = DraftSlot & { boardIndex: number };

function pickOrder(lanes: Array<DraftLane | null>): DraftLane[] | null {
  if (
    lanes.length === DRAFT_LANES.length &&
    lanes.every((lane): lane is DraftLane => Boolean(lane)) &&
    new Set(lanes).size === DRAFT_LANES.length
  ) {
    return lanes;
  }
  return null;
}

/**
 * Ally rows in the order the client is showing them (pick order), once capture
 * has named every lane. Until then the board stays Baron→Support.
 */
export function allySlotsInPickOrder(state: DraftState): OrderedDraftSlot[] {
  const named = pickOrder(state.allyRowLanes);
  if (!named) {
    return state.allies.map((slot, boardIndex) => ({ ...slot, boardIndex }));
  }
  return named.map((lane) => {
    const boardIndex = state.allies.findIndex((slot) => slot.lane === lane);
    return { ...state.allies[boardIndex]!, boardIndex };
  });
}

/**
 * Enemy rows follow the same visual order as the client. Picks are stored by
 * capture row, and the lane label is the ally row's lane once pick order is known.
 */
export function enemySlotsInPickOrder(state: DraftState): OrderedDraftSlot[] {
  const named = pickOrder(state.allyRowLanes);
  return state.enemies.map((slot, boardIndex) => ({
    ...slot,
    lane: named?.[boardIndex] ?? slot.lane,
    boardIndex,
  }));
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

function parseRowSlugs(value: unknown): Array<string | null> {
  return Array.from({ length: DRAFT_LANES.length }, (_, index) => {
    const slug = Array.isArray(value) ? value[index] : null;
    return typeof slug === 'string' && slug ? slug : null;
  });
}

function parseSlugMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: Record<string, string> = {};
  for (const [key, slug] of Object.entries(value as Record<string, unknown>)) {
    if (typeof slug === 'string' && slug) next[key] = slug;
  }
  return next;
}

export type SlotView = {
  slug: string | null;
  isPre: boolean;
  isManual: boolean;
};

/** What the board should render for a pick row after overrides and pre-picks. */
export function slotView(
  state: DraftState,
  side: 'ally' | 'enemy',
  boardIndex: number,
): SlotView {
  const key = `${side}-${boardIndex}`;
  const override = state.overrides[key];
  if (override) return { slug: override, isPre: false, isManual: true };
  const locked = (side === 'ally' ? state.allies : state.enemies)[boardIndex]?.slug ?? null;
  if (locked) return { slug: locked, isPre: false, isManual: false };
  const pre = (side === 'ally' ? state.allyPrePicks : state.enemyPrePicks)[boardIndex] ?? null;
  return { slug: pre, isPre: Boolean(pre), isManual: false };
}

export function clearSlot(state: DraftState, key: string): DraftState {
  const next: DraftState = {
    ...state,
    allies: state.allies.map((slot) => ({ ...slot })),
    enemies: state.enemies.map((slot) => ({ ...slot })),
    allyBans: [...state.allyBans],
    enemyBans: [...state.enemyBans],
    allyPrePicks: [...state.allyPrePicks],
    enemyPrePicks: [...state.enemyPrePicks],
    overrides: { ...state.overrides },
    cleared: { ...state.cleared },
  };
  const match = /^(ally|enemy|allyBans|enemyBans|ban-ally|ban-enemy)-(\d+)$/.exec(key);
  if (!match) return next;
  const role = match[1];
  const index = Number(match[2]);
  let previous: string | null = null;
  if (role === 'ally' || role === 'enemy') {
    const team = role === 'ally' ? next.allies : next.enemies;
    const pres = role === 'ally' ? next.allyPrePicks : next.enemyPrePicks;
    previous = next.overrides[`${role}-${index}`] ?? team[index]?.slug ?? pres[index] ?? null;
    if (team[index]) team[index] = { ...team[index]!, slug: null };
    pres[index] = null;
    delete next.overrides[`${role}-${index}`];
    if (previous) next.cleared[`${role}-${index}`] = previous;
  } else {
    const bans = role === 'allyBans' || role === 'ban-ally' ? next.allyBans : next.enemyBans;
    const banKey = role === 'allyBans' || role === 'ban-ally' ? `ban-ally-${index}` : `ban-enemy-${index}`;
    previous = next.overrides[banKey] ?? bans[index] ?? null;
    bans[index] = null;
    delete next.overrides[banKey];
    if (previous) next.cleared[banKey] = previous;
  }
  return next;
}

export function setOverride(state: DraftState, key: string, slug: string): DraftState {
  const next = clearSlot(state, key);
  delete next.cleared[key];
  next.overrides = { ...next.overrides, [key]: slug };
  const match = /^(ally|enemy|ban-ally|ban-enemy)-(\d+)$/.exec(key);
  if (!match) return next;
  const role = match[1];
  const index = Number(match[2]);
  if (role === 'ally' && next.allies[index]) {
    next.allies[index] = { ...next.allies[index]!, slug };
  } else if (role === 'enemy' && next.enemies[index]) {
    next.enemies[index] = { ...next.enemies[index]!, slug };
  } else if (role === 'ban-ally') {
    next.allyBans[index] = slug;
  } else if (role === 'ban-enemy') {
    next.enemyBans[index] = slug;
  }
  return next;
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
    const allyRowLanes = Array.from({ length: DRAFT_LANES.length }, (_, index) => {
      const raw = Array.isArray(parsed.allyRowLanes) ? parsed.allyRowLanes[index] : null;
      return DRAFT_LANES.includes(raw as TierLane) ? (raw as DraftLane) : null;
    });
    const startedAt =
      typeof parsed.startedAt === 'number' && Number.isFinite(parsed.startedAt)
        ? parsed.startedAt
        : null;
    return {
      allies,
      enemies,
      allyBans: parseBans(parsed.allyBans),
      enemyBans: parseBans(parsed.enemyBans),
      mySlotIndex,
      allyRowLanes,
      allyPrePicks: parseRowSlugs(parsed.allyPrePicks),
      enemyPrePicks: parseRowSlugs(parsed.enemyPrePicks),
      overrides: parseSlugMap(parsed.overrides),
      cleared: parseSlugMap(parsed.cleared),
      startedAt,
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
