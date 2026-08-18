import type { ChangeType, RankBracket, TierLane, TierLetter, TierRuleset } from '@wild-rift-forge/game-data';
import {
  adjustmentKey,
  applyLetterAdjustment,
  assignTierLetter,
  assignTierLetterHybrid,
  assignTierLetterWithHysteresis,
  championTierScore,
  compositeTierScore,
  daysSincePatch,
  fillEmptySPlus,
  patchChangeSign,
  patchNudge,
  TIER_LANES,
  TIER_RULESET_BLENDED,
  TIER_RULESET_CN,
  tierBandCounts,
} from '@wild-rift-forge/game-data';

export type SnapshotRow = {
  snapshotDate: string;
  championId: number;
  lane: TierLane;
  rankBracket: RankBracket;
  winRate: number;
  pickRate: number;
  banRate: number;
};

export type PreviousLetterRow = {
  championId: number;
  lane: TierLane;
  letter: TierLetter;
};

export type ComputedPlacement = {
  snapshotDate: string;
  championId: number;
  lane: TierLane;
  rankBracket: RankBracket;
  letter: TierLetter;
  score: number;
  rankInLane: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  ruleset: TierRuleset;
  adjustedWinRate: number | null;
  skillSpread: number | null;
  confidence: number | null;
  previousLetter: TierLetter | null;
};

export type PatchNudgeInput = {
  championId: number;
  changeTypes: ChangeType[];
};

/** Phase 2 seam: championId:lane → +1 (promote) or −1 (demote). */
export type TierAdjustmentMap = ReadonlyMap<string, number>;

function mean(values: number[]): number {
  if (values.length === 0) {
    return 50;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rateLookup(rows: SnapshotRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(`${row.championId}:${row.lane}:${row.rankBracket}`, row.winRate);
  }
  return map;
}

export function placementsFromCnStats(snapshots: SnapshotRow[]): ComputedPlacement[] {
  const out: ComputedPlacement[] = [];
  for (const lane of TIER_LANES) {
    const laneRows = snapshots
      .filter((row) => row.lane === lane)
      .map((row) => ({
        ...row,
        score: championTierScore(row.winRate, row.pickRate, row.banRate),
      }))
      .sort((a, b) => b.score - a.score || b.winRate - a.winRate);
    const counts = tierBandCounts(laneRows.length);
    const laneOut: ComputedPlacement[] = laneRows.map((row, index) => {
      const rankInLane = index + 1;
      return {
        snapshotDate: row.snapshotDate,
        championId: row.championId,
        lane: row.lane,
        rankBracket: row.rankBracket,
        letter: assignTierLetter(rankInLane, counts),
        score: row.score,
        rankInLane,
        winRate: row.winRate,
        pickRate: row.pickRate,
        banRate: row.banRate,
        ruleset: TIER_RULESET_CN,
        adjustedWinRate: null,
        skillSpread: null,
        confidence: null,
        previousLetter: null,
      };
    });
    out.push(...fillEmptySPlus(laneOut, counts['S+']));
  }
  return out;
}

export function placementsFromBlended(input: {
  snapshots: SnapshotRow[];
  bracket: RankBracket;
  previous: PreviousLetterRow[];
  nudgeByChampion: ReadonlyMap<number, number>;
  adjustments?: TierAdjustmentMap;
}): ComputedPlacement[] {
  const bracketRows = input.snapshots.filter((row) => row.rankBracket === input.bracket);
  const rates = rateLookup(input.snapshots);
  const previousByKey = new Map(
    input.previous.map((row) => [adjustmentKey(row.championId, row.lane), row.letter]),
  );
  const out: ComputedPlacement[] = [];

  for (const lane of TIER_LANES) {
    const laneRows = bracketRows.filter((row) => row.lane === lane);
    const laneMean = mean(laneRows.map((row) => row.winRate));
    const scored = laneRows
      .map((row) => {
        const computed = compositeTierScore({
          winRate: row.winRate,
          pickRate: row.pickRate,
          banRate: row.banRate,
          laneMeanWinRate: laneMean,
          challengerWinRate: rates.get(`${row.championId}:${row.lane}:challenger_plus`) ?? null,
          allWinRate: rates.get(`${row.championId}:${row.lane}:all`) ?? null,
          patchNudge: input.nudgeByChampion.get(row.championId) ?? 0,
        });
        return { row, ...computed };
      })
      .sort((a, b) => b.score - a.score || b.row.winRate - a.row.winRate);
    const counts = tierBandCounts(scored.length);
    const laneOut: ComputedPlacement[] = scored.map((entry, index) => {
      const rankInLane = index + 1;
      const previousLetter = previousByKey.get(adjustmentKey(entry.row.championId, lane)) ?? null;
      const proposed = assignTierLetterHybrid(rankInLane, counts, entry.score);
      const held = assignTierLetterWithHysteresis(proposed, previousLetter, entry.score);
      const delta = input.adjustments?.get(adjustmentKey(entry.row.championId, lane)) ?? 0;
      return {
        snapshotDate: entry.row.snapshotDate,
        championId: entry.row.championId,
        lane,
        rankBracket: input.bracket,
        letter: applyLetterAdjustment(held, delta),
        score: entry.score,
        rankInLane,
        winRate: entry.row.winRate,
        pickRate: entry.row.pickRate,
        banRate: entry.row.banRate,
        ruleset: TIER_RULESET_BLENDED,
        adjustedWinRate: entry.adjustedWinRate,
        skillSpread: entry.skillSpread,
        confidence: entry.confidence,
        previousLetter,
      };
    });
    out.push(...fillEmptySPlus(laneOut, counts['S+']));
  }
  return out;
}

export function championNudgesFromChanges(
  changes: Array<{ entityType: string; entityName: string; changeType: ChangeType }>,
  roster: Array<{ id: number; slug: string }>,
  matchSlug: (name: string, slugs: string[]) => string | null,
): PatchNudgeInput[] {
  const slugs = roster.map((champion) => champion.slug);
  const bySlug = new Map(roster.map((champion) => [champion.slug, champion]));
  return changes.flatMap((change) => {
    if (change.entityType !== 'champion') {
      return [];
    }
    const slug = matchSlug(change.entityName, slugs);
    const champion = slug ? bySlug.get(slug) : undefined;
    return champion ? [{ championId: champion.id, changeTypes: [change.changeType] }] : [];
  });
}

export function nudgeByChampionId(
  nudges: PatchNudgeInput[],
  releaseDate: string | null | undefined,
  snapshotDate: string,
): Map<number, number> {
  const typesByChampion = new Map<number, ChangeType[]>();
  for (const row of nudges) {
    const current = typesByChampion.get(row.championId) ?? [];
    current.push(...row.changeTypes);
    typesByChampion.set(row.championId, current);
  }
  const days = daysSincePatch(releaseDate, snapshotDate);
  const out = new Map<number, number>();
  for (const [championId, changeTypes] of typesByChampion) {
    out.set(championId, patchNudge(patchChangeSign(changeTypes), days));
  }
  return out;
}
