import type { Champion } from '@wildrift-forge/game-data';
import { getPool } from './client';

export interface StoredChampion extends Champion {
  id: number;
}

/** Insert or update a champion by slug. Returns the champion id. */
export async function upsertChampion(champion: Champion): Promise<number> {
  const result = await getPool().query<{ id: number }>(
    `INSERT INTO champions (slug, name, title, roles, difficulty, image_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (slug)
     DO UPDATE SET
       name = EXCLUDED.name,
       title = COALESCE(EXCLUDED.title, champions.title),
       roles = CASE WHEN EXCLUDED.roles = '{}' THEN champions.roles ELSE EXCLUDED.roles END,
       difficulty = COALESCE(EXCLUDED.difficulty, champions.difficulty),
       image_url = COALESCE(EXCLUDED.image_url, champions.image_url),
       updated_at = now()
     RETURNING id`,
    [
      champion.slug,
      champion.name,
      champion.title,
      champion.roles,
      champion.difficulty,
      champion.imageUrl,
    ],
  );
  return result.rows[0]!.id;
}

export async function listChampions(): Promise<StoredChampion[]> {
  const result = await getPool().query(
    `SELECT id, slug, name, title, roles, difficulty, image_url FROM champions ORDER BY name`,
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    title: (row.title as string) ?? null,
    roles: (row.roles as string[]) ?? [],
    difficulty: (row.difficulty as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
  }));
}
