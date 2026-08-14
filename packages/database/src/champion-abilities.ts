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

/** Every scraped kit, keyed by champion slug, for patch notes and bulk loaders. */
export async function listAbilitiesBySlug(): Promise<Map<string, StoredChampionAbility[]>> {
  const result = await getPool().query(
    `SELECT a.id, a.champion_id, a.slot, a.name, a.description, a.icon_url, a.video_url,
            a.sort_order, c.slug
     FROM champion_abilities a
     JOIN champions c ON c.id = a.champion_id
     ORDER BY c.slug, a.sort_order, a.slot`,
  );
  const bySlug = new Map<string, StoredChampionAbility[]>();
  for (const row of result.rows) {
    const slug = row.slug as string;
    const list = bySlug.get(slug) ?? [];
    list.push(mapAbilityRow(row));
    bySlug.set(slug, list);
  }
  return bySlug;
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
