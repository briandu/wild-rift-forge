import type { ApiChampion, TierPlacementDto } from './api-types';
import { bestPlacement, placementsForSlug } from './placements';

export function playsLane(placements: TierPlacementDto[], slug: string, lane: string): boolean {
  return placementsForSlug(placements, slug).some((row) => row.lane === lane);
}

/** Pool order, scoped to the lane. Falls back to the full pool if none play it. */
export function poolInLane(pool: string[], placements: TierPlacementDto[], lane: string): string[] {
  const inLane = pool.filter((slug) => playsLane(placements, slug, lane));
  return inLane.length > 0 ? inLane : pool;
}

function pickRateInLane(placements: TierPlacementDto[], slug: string, lane: string): number {
  return bestPlacement(placementsForSlug(placements, slug), lane)?.pickRate ?? 0;
}

export function commonLaneChampions(
  champions: ApiChampion[],
  placements: TierPlacementDto[],
  lane: string,
  exclude: readonly string[],
  limit: number,
): ApiChampion[] {
  const blocked = new Set(exclude.filter(Boolean));
  return champions
    .filter((champion) => !blocked.has(champion.slug) && playsLane(placements, champion.slug, lane))
    .sort((a, b) => {
      const gap = pickRateInLane(placements, b.slug, lane) - pickRateInLane(placements, a.slug, lane);
      return gap || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

/** Your usual picks in this lane first, then the next most-played laners. */
export function youLaneSuggestions(
  champions: ApiChampion[],
  placements: TierPlacementDto[],
  lane: string,
  pool: string[],
  exclude: readonly string[],
  limit: number,
): { fromPool: ApiChampion[]; more: ApiChampion[] } {
  const blocked = new Set(exclude.filter(Boolean));
  const fromPool = poolInLane(pool, placements, lane)
    .filter((slug) => !blocked.has(slug))
    .flatMap((slug) => {
      const champion = champions.find((item) => item.slug === slug);
      return champion ? [champion] : [];
    })
    .slice(0, limit);
  const more = commonLaneChampions(
    champions,
    placements,
    lane,
    [...blocked, ...fromPool.map((champion) => champion.slug)],
    Math.max(0, limit - fromPool.length),
  );
  return { fromPool, more };
}
