import { TIER_LANES, type TierLane, type TierLetter } from '@wild-rift-forge/game-data';
import type { ApiChampion, PatchChampionChangeDto, TierPlacementDto } from './api-types';

export function parseTierLane(value: string | undefined | null): TierLane | undefined {
  if (!value) return undefined;
  return TIER_LANES.find((lane) => lane.toLowerCase() === value.toLowerCase());
}

/** Counters payloads label lanes as "TOP LANE" / "JUNGLE". */
export function laneFromLabel(label: string | undefined | null): TierLane | undefined {
  if (!label) return undefined;
  const lower = label.toLowerCase();
  return TIER_LANES.find((lane) => lower.includes(lane.toLowerCase()));
}

export function placementsForSlug(
  placements: TierPlacementDto[],
  slug: string,
): TierPlacementDto[] {
  const key = slug.toLowerCase();
  return placements.filter((row) => row.slug === key);
}

/** Best row for a champion: preferred lane, else highest score. */
export function bestPlacement(
  rows: TierPlacementDto[],
  preferred?: TierLane,
): TierPlacementDto | undefined {
  if (preferred) {
    const match = rows.find((row) => row.lane === preferred);
    if (match) return match;
  }
  return rows.reduce<TierPlacementDto | undefined>(
    (best, row) => (!best || row.score > best.score ? row : best),
    undefined,
  );
}

/** One row per slug, keeping the highest-score lane. */
export function uniqueBestPlacements(placements: TierPlacementDto[]): TierPlacementDto[] {
  const bySlug = new Map<string, TierPlacementDto>();
  for (const row of placements) {
    const current = bySlug.get(row.slug);
    if (!current || row.score > current.score) {
      bySlug.set(row.slug, row);
    }
  }
  return [...bySlug.values()];
}

export function mostPicked(placements: TierPlacementDto[], limit: number): TierPlacementDto[] {
  return [...uniqueBestPlacements(placements)]
    .sort((a, b) => b.pickRate - a.pickRate || b.score - a.score)
    .slice(0, limit);
}

/** Highest pick-rate champion in each lane, in display order. */
export function mostPickedByLane(placements: TierPlacementDto[]): TierPlacementDto[] {
  const byLane = new Map<TierLane, TierPlacementDto>();
  for (const row of placements) {
    const current = byLane.get(row.lane);
    if (!current || row.pickRate > current.pickRate) {
      byLane.set(row.lane, row);
    }
  }
  return TIER_LANES.map((lane) => byLane.get(lane)).filter((row): row is TierPlacementDto =>
    Boolean(row),
  );
}

export function formatRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function tierBadge(letter: TierLetter): string {
  return `${letter} TIER`;
}

export function rosterBySlug(champions: ApiChampion[]): Map<string, ApiChampion> {
  return new Map(champions.map((champion) => [champion.slug, champion]));
}

export function patchNoteFor(
  slug: string,
  notes: PatchChampionChangeDto[] | undefined,
): PatchChampionChangeDto | undefined {
  const key = slug.toLowerCase();
  return notes?.find((row) => row.slug === key);
}

export function patchNoteLine(
  note: PatchChampionChangeDto | undefined,
  version: string | null | undefined,
): string | undefined {
  if (!note) return undefined;
  const patch = version ? ` in ${version}` : ' this patch';
  if (note.kind === 'BUFF') return `Buffed${patch}`;
  if (note.kind === 'NERF') return `Nerfed${patch}`;
  return `Adjusted${patch}`;
}
