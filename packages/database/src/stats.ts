import {
  DEFAULT_TIER_RULESET,
  type RankBracket,
  type TierLane,
  type TierLetter,
  type TierRuleset,
} from '@wild-rift-forge/game-data';
import { getPool } from './client';

export interface StatSnapshotInput {
  snapshotDate: string;
  championId: number;
  lane: TierLane;
  rankBracket: RankBracket;
  winRate: number;
  pickRate: number;
  banRate: number;
  tencentStrength: number | null;
  tencentStrengthLevel: number | null;
  sourceUrl: string;
  patchVersion?: string | null;
}

export interface StoredStatSnapshot {
  snapshotDate: string;
  championId: number;
  lane: TierLane;
  rankBracket: RankBracket;
  winRate: number;
  pickRate: number;
  banRate: number;
}

export interface TierPlacementInput {
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
  adjustedWinRate?: number | null;
  skillSpread?: number | null;
  confidence?: number | null;
  previousLetter?: TierLetter | null;
}

export interface StoredTierPlacement extends TierPlacementInput {
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  why: string | null;
}

function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

/** Insert daily snapshots. Same-day rows are skipped (append-only). */
export async function insertStatSnapshots(rows: StatSnapshotInput[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  const pool = getPool();
  let inserted = 0;
  const chunkSize = 80;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, index) => {
      const o = index * 11;
      values.push(
        row.snapshotDate,
        row.championId,
        row.lane,
        row.rankBracket,
        row.winRate,
        row.pickRate,
        row.banRate,
        row.tencentStrength,
        row.tencentStrengthLevel,
        row.sourceUrl,
        row.patchVersion ?? null,
      );
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10}, $${o + 11})`;
    });
    const result = await pool.query(
      `INSERT INTO champion_stat_snapshots (
         snapshot_date, champion_id, lane, rank_bracket, win_rate, pick_rate, ban_rate,
         tencent_strength, tencent_strength_level, source_url, patch_version
       )
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (snapshot_date, champion_id, lane, rank_bracket) DO NOTHING`,
      values,
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

function mapSnapshotRows(rows: Array<Record<string, unknown>>): StoredStatSnapshot[] {
  return rows.map((row) => ({
    snapshotDate: toIsoDate(row.snapshot_date as Date | string),
    championId: row.champion_id as number,
    lane: row.lane as TierLane,
    rankBracket: row.rank_bracket as RankBracket,
    winRate: num(row.win_rate),
    pickRate: num(row.pick_rate),
    banRate: num(row.ban_rate),
  }));
}

export async function listSnapshotsForDate(
  snapshotDate: string,
  rankBracket: RankBracket,
): Promise<StoredStatSnapshot[]> {
  const result = await getPool().query(
    `SELECT snapshot_date, champion_id, lane, rank_bracket, win_rate, pick_rate, ban_rate
     FROM champion_stat_snapshots
     WHERE snapshot_date = $1 AND rank_bracket = $2`,
    [snapshotDate, rankBracket],
  );
  return mapSnapshotRows(result.rows);
}

export async function listSnapshotsForDateAllBrackets(
  snapshotDate: string,
): Promise<StoredStatSnapshot[]> {
  const result = await getPool().query(
    `SELECT snapshot_date, champion_id, lane, rank_bracket, win_rate, pick_rate, ban_rate
     FROM champion_stat_snapshots
     WHERE snapshot_date = $1`,
    [snapshotDate],
  );
  return mapSnapshotRows(result.rows);
}

export async function listSnapshotDates(): Promise<string[]> {
  const result = await getPool().query<{ snapshot_date: Date | string }>(
    `SELECT DISTINCT snapshot_date
     FROM champion_stat_snapshots
     ORDER BY snapshot_date ASC`,
  );
  return result.rows.map((row) => toIsoDate(row.snapshot_date));
}

export async function getLatestSnapshotDate(rankBracket: RankBracket): Promise<string | null> {
  const result = await getPool().query<{ snapshot_date: Date | string }>(
    `SELECT snapshot_date
     FROM champion_stat_snapshots
     WHERE rank_bracket = $1
     ORDER BY snapshot_date DESC
     LIMIT 1`,
    [rankBracket],
  );
  const value = result.rows[0]?.snapshot_date;
  return value ? toIsoDate(value) : null;
}

export async function getPreviousSnapshotDate(
  rankBracket: RankBracket,
  beforeDate: string,
): Promise<string | null> {
  const result = await getPool().query<{ snapshot_date: Date | string }>(
    `SELECT snapshot_date
     FROM champion_stat_snapshots
     WHERE rank_bracket = $1 AND snapshot_date < $2
     ORDER BY snapshot_date DESC
     LIMIT 1`,
    [rankBracket, beforeDate],
  );
  const value = result.rows[0]?.snapshot_date;
  return value ? toIsoDate(value) : null;
}

/** Replace placements for one snapshot date + bracket + ruleset. */
export async function replaceTierPlacements(
  snapshotDate: string,
  rankBracket: RankBracket,
  ruleset: TierRuleset,
  rows: TierPlacementInput[],
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM champion_tier_placements
       WHERE snapshot_date = $1 AND rank_bracket = $2 AND ruleset = $3`,
      [snapshotDate, rankBracket, ruleset],
    );
    const chunkSize = 80;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values: unknown[] = [];
      const placeholders = chunk.map((row, index) => {
        const o = index * 15;
        values.push(
          row.snapshotDate,
          row.championId,
          row.lane,
          row.rankBracket,
          row.letter,
          row.score,
          row.rankInLane,
          row.winRate,
          row.pickRate,
          row.banRate,
          row.ruleset,
          row.adjustedWinRate ?? null,
          row.skillSpread ?? null,
          row.confidence ?? null,
          row.previousLetter ?? null,
        );
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10}, $${o + 11}, $${o + 12}, $${o + 13}, $${o + 14}, $${o + 15})`;
      });
      await client.query(
        `INSERT INTO champion_tier_placements (
           snapshot_date, champion_id, lane, rank_bracket, letter, score, rank_in_lane,
           win_rate, pick_rate, ban_rate, ruleset, adjusted_win_rate, skill_spread,
           confidence, previous_letter
         )
         VALUES ${placeholders.join(', ')}`,
        values,
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listPlacementsForDate(
  snapshotDate: string,
  rankBracket: RankBracket,
  ruleset: TierRuleset,
): Promise<Array<{ championId: number; lane: TierLane; letter: TierLetter }>> {
  const result = await getPool().query(
    `SELECT champion_id, lane, letter
     FROM champion_tier_placements
     WHERE snapshot_date = $1 AND rank_bracket = $2 AND ruleset = $3`,
    [snapshotDate, rankBracket, ruleset],
  );
  return result.rows.map((row) => ({
    championId: row.champion_id as number,
    lane: row.lane as TierLane,
    letter: row.letter as TierLetter,
  }));
}

export async function listLatestTierPlacements(
  rankBracket: RankBracket,
  lane?: TierLane,
  ruleset: TierRuleset = DEFAULT_TIER_RULESET,
): Promise<{ snapshotDate: string; placements: StoredTierPlacement[] }> {
  const snapshotDate = await getLatestSnapshotDate(rankBracket);
  if (!snapshotDate) {
    return { snapshotDate: '', placements: [] };
  }
  const result = await getPool().query(
    `SELECT p.snapshot_date, p.champion_id, p.lane, p.rank_bracket, p.letter, p.score,
            p.rank_in_lane, p.win_rate, p.pick_rate, p.ban_rate, p.ruleset,
            p.adjusted_win_rate, p.skill_spread, p.confidence, p.previous_letter,
            c.slug, c.name, c.thumbnail_url, c.image_url, e.why
     FROM champion_tier_placements p
     JOIN champions c ON c.id = p.champion_id
     LEFT JOIN tier_explanations e
       ON e.snapshot_date = p.snapshot_date
      AND e.champion_id = p.champion_id
      AND e.lane = p.lane
      AND e.rank_bracket = p.rank_bracket
      AND e.ruleset = p.ruleset
     WHERE p.snapshot_date = $1 AND p.rank_bracket = $2 AND p.ruleset = $3
       AND ($4::text IS NULL OR p.lane = $4)
     ORDER BY p.lane, p.rank_in_lane`,
    [snapshotDate, rankBracket, ruleset, lane ?? null],
  );
  return {
    snapshotDate,
    placements: result.rows.map((row) => ({
      snapshotDate: toIsoDate(row.snapshot_date as Date | string),
      championId: row.champion_id as number,
      lane: row.lane as TierLane,
      rankBracket: row.rank_bracket as RankBracket,
      letter: row.letter as TierLetter,
      score: num(row.score),
      rankInLane: row.rank_in_lane as number,
      winRate: num(row.win_rate),
      pickRate: num(row.pick_rate),
      banRate: num(row.ban_rate),
      ruleset: row.ruleset as TierRuleset,
      adjustedWinRate: row.adjusted_win_rate == null ? null : num(row.adjusted_win_rate),
      skillSpread: row.skill_spread == null ? null : num(row.skill_spread),
      confidence: row.confidence == null ? null : num(row.confidence),
      previousLetter: (row.previous_letter as TierLetter | null) ?? null,
      slug: row.slug as string,
      name: row.name as string,
      thumbnailUrl: (row.thumbnail_url as string) ?? null,
      imageUrl: (row.image_url as string) ?? null,
      why: typeof row.why === 'string' && row.why.trim() ? row.why : null,
    })),
  };
}

export type LaneStatSnapshot = {
  slug: string;
  name: string;
  lane: TierLane;
  winRate: number;
  pickRate: number;
  banRate: number;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

export async function listLatestLaneStats(
  rankBracket: RankBracket,
): Promise<{ snapshotDate: string; rows: LaneStatSnapshot[] }> {
  const snapshotDate = await getLatestSnapshotDate(rankBracket);
  if (!snapshotDate) {
    return { snapshotDate: '', rows: [] };
  }
  const result = await getPool().query(
    `SELECT c.slug, c.name, c.image_url, c.thumbnail_url,
            s.lane, s.win_rate, s.pick_rate, s.ban_rate
     FROM champion_stat_snapshots s
     JOIN champions c ON c.id = s.champion_id
     WHERE s.snapshot_date = $1 AND s.rank_bracket = $2`,
    [snapshotDate, rankBracket],
  );
  return {
    snapshotDate,
    rows: result.rows.map((row) => ({
      slug: row.slug as string,
      name: row.name as string,
      lane: row.lane as TierLane,
      winRate: num(row.win_rate),
      pickRate: num(row.pick_rate),
      banRate: num(row.ban_rate),
      imageUrl: (row.image_url as string) ?? null,
      thumbnailUrl: (row.thumbnail_url as string) ?? null,
    })),
  };
}

export async function listWinRatesByChampion(
  snapshotDate: string,
  rankBracket: RankBracket,
): Promise<Map<string, { winRate: number; pickRate: number }>> {
  const result = await getPool().query(
    `SELECT c.slug, s.win_rate, s.pick_rate
     FROM champion_stat_snapshots s
     JOIN champions c ON c.id = s.champion_id
     WHERE s.snapshot_date = $1 AND s.rank_bracket = $2
     ORDER BY s.pick_rate DESC`,
    [snapshotDate, rankBracket],
  );
  const map = new Map<string, { winRate: number; pickRate: number }>();
  for (const row of result.rows) {
    const slug = row.slug as string;
    if (!map.has(slug)) {
      map.set(slug, { winRate: num(row.win_rate), pickRate: num(row.pick_rate) });
    }
  }
  return map;
}
