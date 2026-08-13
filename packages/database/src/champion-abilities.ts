import type { AbilitySlot, ChampionAbility } from '@wild-rift-forge/game-data';
import { getPool } from './client';

export interface StoredChampionAbility extends ChampionAbility {
  id: number;
  championId: number;
}

/**
 * Replace a champion's full ability kit. Upserts each slot, then removes any
 * slots that are no longer present (rare kit reshuffles).
 */
export async function replaceChampionAbilities(
  championId: number,
  abilities: ChampionAbility[],
): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const ability of abilities) {
      await client.query(
        `INSERT INTO champion_abilities (
           champion_id, slot, name, description, icon_url, video_url, sort_order
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (champion_id, slot)
         DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           icon_url = EXCLUDED.icon_url,
           video_url = EXCLUDED.video_url,
           sort_order = EXCLUDED.sort_order,
           updated_at = now()`,
        [
          championId,
          ability.slot,
          ability.name,
          ability.description,
          ability.iconUrl,
          ability.videoUrl,
          ability.sortOrder,
        ],
      );
    }
    const slots = abilities.map((ability) => ability.slot);
    if (slots.length === 0) {
      await client.query(`DELETE FROM champion_abilities WHERE champion_id = $1`, [championId]);
    } else {
      await client.query(
        `DELETE FROM champion_abilities
         WHERE champion_id = $1
           AND slot <> ALL($2::text[])`,
        [championId, slots],
      );
    }
    await client.query('COMMIT');
    return abilities.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listChampionAbilities(
  championId: number,
): Promise<StoredChampionAbility[]> {
  const result = await getPool().query(
    `SELECT id, champion_id, slot, name, description, icon_url, video_url, sort_order
     FROM champion_abilities
     WHERE champion_id = $1
     ORDER BY sort_order, slot`,
    [championId],
  );
  return result.rows.map(mapAbilityRow);
}

function mapAbilityRow(row: Record<string, unknown>): StoredChampionAbility {
  return {
    id: row.id as number,
    championId: row.champion_id as number,
    slot: row.slot as AbilitySlot,
    name: row.name as string,
    description: (row.description as string) ?? null,
    iconUrl: (row.icon_url as string) ?? null,
    videoUrl: (row.video_url as string) ?? null,
    sortOrder: row.sort_order as number,
  };
}
