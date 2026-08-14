import type { RankBracket, TierLane, TierLetter, TierRuleset } from '@wild-rift-forge/game-data';
import { getPool } from './client';

export interface TierExplanationInput {
  snapshotDate: string;
  championId: number;
  lane: TierLane;
  rankBracket: RankBracket;
  ruleset: TierRuleset;
  letter: TierLetter;
  model: string;
  promptHash: string;
  why: string;
}

export interface StoredTierExplanation {
  snapshotDate: string;
  championId: number;
  lane: TierLane;
  rankBracket: RankBracket;
  ruleset: TierRuleset;
  letter: TierLetter;
  promptHash: string;
  why: string;
}

function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export async function listTierExplanations(
  snapshotDate: string,
  rankBracket: RankBracket,
  ruleset: TierRuleset,
): Promise<StoredTierExplanation[]> {
  const result = await getPool().query(
    `SELECT snapshot_date, champion_id, lane, rank_bracket, ruleset, letter, prompt_hash, why
     FROM tier_explanations
     WHERE snapshot_date = $1 AND rank_bracket = $2 AND ruleset = $3`,
    [snapshotDate, rankBracket, ruleset],
  );
  return result.rows.map((row) => ({
    snapshotDate: toIsoDate(row.snapshot_date as Date | string),
    championId: row.champion_id as number,
    lane: row.lane as TierLane,
    rankBracket: row.rank_bracket as RankBracket,
    ruleset: row.ruleset as TierRuleset,
    letter: row.letter as TierLetter,
    promptHash: row.prompt_hash as string,
    why: row.why as string,
  }));
}

export async function upsertTierExplanations(rows: TierExplanationInput[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  const pool = getPool();
  let written = 0;
  const chunkSize = 40;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, index) => {
      const o = index * 9;
      values.push(
        row.snapshotDate,
        row.championId,
        row.lane,
        row.rankBracket,
        row.ruleset,
        row.letter,
        row.model,
        row.promptHash,
        row.why,
      );
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9})`;
    });
    const result = await pool.query(
      `INSERT INTO tier_explanations (
         snapshot_date, champion_id, lane, rank_bracket, ruleset, letter, model, prompt_hash, why
       )
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (snapshot_date, champion_id, lane, rank_bracket, ruleset)
       DO UPDATE SET
         letter = EXCLUDED.letter,
         model = EXCLUDED.model,
         prompt_hash = EXCLUDED.prompt_hash,
         why = EXCLUDED.why,
         updated_at = now()
       WHERE tier_explanations.prompt_hash IS DISTINCT FROM EXCLUDED.prompt_hash`,
      values,
    );
    written += result.rowCount ?? 0;
  }
  return written;
}
