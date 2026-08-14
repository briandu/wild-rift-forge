import { TIER_LANES, type TierLane } from '@wild-rift-forge/game-data';
import { parseTierLane } from './placements';

export const DEFAULT_ROLE_ORDER: TierLane[] = [...TIER_LANES];

export type RoleRankTag = 'PRIMARY' | 'SECONDARY' | 'FILL';

/** Accept any stored array and return a permutation of the five lanes. */
export function normalizeRoleOrder(value: unknown): TierLane[] {
  const seen = new Set<TierLane>();
  const next: TierLane[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      const lane = parseTierLane(String(item));
      if (lane && !seen.has(lane)) {
        seen.add(lane);
        next.push(lane);
      }
    }
  }
  for (const lane of TIER_LANES) {
    if (!seen.has(lane)) next.push(lane);
  }
  return next;
}

/** First role in `order` that the champion actually plays. */
export function preferredLaneOf(
  lanes: readonly string[],
  order: readonly string[] = DEFAULT_ROLE_ORDER,
): TierLane | undefined {
  const available = new Set(lanes);
  for (const role of order) {
    if (available.has(role)) return role as TierLane;
  }
  return parseTierLane(lanes[0]);
}

/** Shared lane if both play one, else the first champ's preferred role. */
export function preferredSharedLane(
  youLanes: readonly string[],
  themLanes: readonly string[],
  order: readonly string[] = DEFAULT_ROLE_ORDER,
): TierLane {
  const shared = youLanes.filter((lane) => themLanes.includes(lane));
  return preferredLaneOf(shared.length ? shared : youLanes, order) ?? parseTierLane(order[0]) ?? 'Top';
}

export function roleRankTag(index: number): RoleRankTag {
  if (index === 0) return 'PRIMARY';
  if (index === 1) return 'SECONDARY';
  return 'FILL';
}

export function roleCountLabel(count: number): string {
  return count === 1 ? '1 champion in your pool' : `${count} champions in your pool`;
}
