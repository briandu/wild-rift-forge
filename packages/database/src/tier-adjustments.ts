import type { TierLane, TierLetter, TierRuleset } from '@wild-rift-forge/game-data';
import { getPool } from './client';

export interface TierAdjustmentInput {
  cycleKey: string;
  ruleset: TierRuleset;
  championId: number;
  lane: TierLane;
  delta: number;
  letterBefore: TierLetter;
  letterAfter: TierLetter;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  model: string;
  promptHash: string;
}

export interface StoredTierAdjustment extends TierAdjustmentInput {}

export async function listTierAdjustments(
  cycleKey: string,
  ruleset: TierRuleset,
): Promise<StoredTierAdjustment[]> {
  const result = await getPool().query(
    `SELECT cycle_key, ruleset, champion_id, lane, delta, letter_before, letter_after,
            reason, confidence, model, prompt_hash
     FROM tier_adjustments
     WHERE cycle_key = $1 AND ruleset = $2`,
    [cycleKey, ruleset],
  );
  return result.rows.map((row) => ({
    cycleKey: row.cycle_key as string,
    ruleset: row.ruleset as TierRuleset,
    championId: row.champion_id as number,
    lane: row.lane as TierLane,
    delta: row.delta as number,
    letterBefore: row.letter_before as TierLetter,
    letterAfter: row.letter_after as TierLetter,
    reason: row.reason as string,
    confidence: row.confidence as StoredTierAdjustment['confidence'],
    model: row.model as string,
    promptHash: row.prompt_hash as string,
  }));
}

export async function replaceTierAdjustments(
  cycleKey: string,
  ruleset: TierRuleset,
  rows: TierAdjustmentInput[],
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM tier_adjustments WHERE cycle_key = $1 AND ruleset = $2`, [
      cycleKey,
      ruleset,
    ]);
    if (rows.length > 0) {
      const values: unknown[] = [];
      const placeholders = rows.map((row, index) => {
        const o = index * 11;
        values.push(
          row.cycleKey,
          row.ruleset,
          row.championId,
          row.lane,
          row.delta,
          row.letterBefore,
          row.letterAfter,
          row.reason,
          row.confidence,
          row.model,
          row.promptHash,
        );
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10}, $${o + 11})`;
      });
      await client.query(
        `INSERT INTO tier_adjustments (
           cycle_key, ruleset, champion_id, lane, delta, letter_before, letter_after,
           reason, confidence, model, prompt_hash
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
