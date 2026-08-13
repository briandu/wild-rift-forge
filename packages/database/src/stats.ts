import type { RankBracket, TierLane, TierLetter } from '@wild-rift-forge/game-data';
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
}

export interface StoredTierPlacement extends TierPlacementInput {
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
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
      const o = index * 10;
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
      );
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10})`;
    });
    const result = await pool.query(
      `INSERT INTO champion_stat_snapshots (
         snapshot_date, champion_id, lane, rank_bracket, win_rate, pick_rate, ban_rate,
         tencent_strength, tencent_strength_level, source_url
       )
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (snapshot_date, champion_id, lane, rank_bracket) DO NOTHING`,
      values,
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
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
  return result.rows.map((row) => ({
    snapshotDate: toIsoDate(row.snapshot_date as Date | string),
    championId: row.champion_id as number,
    lane: row.lane as TierLane,
    rankBracket: row.rank_bracket as RankBracket,
    winRate: num(row.win_rate),
    pickRate: num(row.pick_rate),
    banRate: num(row.ban_rate),
  }));
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

/** Replace placements for one snapshot date + bracket. */
export async function replaceTierPlacements(
  snapshotDate: string,
  rankBracket: RankBracket,
  rows: TierPlacementInput[],
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM champion_tier_placements WHERE snapshot_date = $1 AND rank_bracket = $2`,
      [snapshotDate, rankBracket],
    );
    const chunkSize = 80;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values: unknown[] = [];
      const placeholders = chunk.map((row, index) => {
        const o = index * 10;
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
        );
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10})`;
      });
      await client.query(
        `INSERT INTO champion_tier_placements (
           snapshot_date, champion_id, lane, rank_bracket, letter, score, rank_in_lane,
           win_rate, pick_rate, ban_rate
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

export async function listLatestTierPlacements(
  rankBracket: RankBracket,
  lane?: TierLane,
): Promise<{ snapshotDate: string; placements: StoredTierPlacement[] }> {
  const snapshotDate = await getLatestSnapshotDate(rankBracket);
  if (!snapshotDate) {
    return { snapshotDate: '', placements: [] };
  }
  const result = await getPool().query(
    `SELECT p.snapshot_date, p.champion_id, p.lane, p.rank_bracket, p.letter, p.score,
            p.rank_in_lane, p.win_rate, p.pick_rate, p.ban_rate,
            c.slug, c.name, c.thumbnail_url, c.image_url
     FROM champion_tier_placements p
     JOIN champions c ON c.id = p.champion_id
     WHERE p.snapshot_date = $1 AND p.rank_bracket = $2
       AND ($3::text IS NULL OR p.lane = $3)
     ORDER BY p.lane, p.rank_in_lane`,
    [snapshotDate, rankBracket, lane ?? null],
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
      slug: row.slug as string,
      name: row.name as string,
      thumbnailUrl: (row.thumbnail_url as string) ?? null,
      imageUrl: (row.image_url as string) ?? null,
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
