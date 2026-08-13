import type { Champion } from '@wild-rift-forge/game-data';
import { getPool } from './client';

export interface StoredChampion extends Champion {
  id: number;
  imageSourceUrl: string | null;
  imageContentHash: string | null;
  imageStoragePath: string | null;
  thumbnailUrl: string | null;
  thumbnailSourceUrl: string | null;
  thumbnailContentHash: string | null;
  thumbnailStoragePath: string | null;
}

export interface ChampionImageAsset {
  imageUrl: string;
  imageContentHash: string;
  imageStoragePath: string;
}

const CHAMPION_COLUMNS = `id, slug, name, title, roles, difficulty,
            image_url, image_source_url, image_content_hash, image_storage_path,
            thumbnail_url, thumbnail_source_url, thumbnail_content_hash, thumbnail_storage_path`;

/** Insert or update a champion by slug. Returns the champion id. */
export async function upsertChampion(champion: Champion): Promise<number> {
  const sourceUrl = champion.imageSourceUrl ?? champion.imageUrl;
  const result = await getPool().query<{ id: number }>(
    `INSERT INTO champions (
       slug, name, title, roles, difficulty, image_url, image_source_url
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (slug)
     DO UPDATE SET
       name = EXCLUDED.name,
       title = COALESCE(EXCLUDED.title, champions.title),
       roles = CASE WHEN EXCLUDED.roles = '{}' THEN champions.roles ELSE EXCLUDED.roles END,
       difficulty = COALESCE(EXCLUDED.difficulty, champions.difficulty),
       image_source_url = COALESCE(EXCLUDED.image_source_url, champions.image_source_url),
       -- Keep hosted Storage URL once synced. Only replace the display URL when
       -- this upsert also brings a new source (e.g. default skin splash); otherwise
       -- preserve an existing skin URL instead of clobbering it with list-card art.
       image_url = CASE
         WHEN champions.image_storage_path IS NOT NULL THEN champions.image_url
         WHEN EXCLUDED.image_source_url IS NOT NULL THEN COALESCE(EXCLUDED.image_url, champions.image_url)
         ELSE COALESCE(champions.image_url, EXCLUDED.image_url)
       END,
       updated_at = now()
     RETURNING id`,
    [
      champion.slug,
      champion.name,
      champion.title,
      champion.roles,
      champion.difficulty,
      champion.imageUrl,
      sourceUrl,
    ],
  );
  return result.rows[0]!.id;
}

/** Persist a hosted champion image after a successful Storage upload. */
export async function updateChampionImageAsset(
  slug: string,
  asset: ChampionImageAsset,
): Promise<void> {
  await getPool().query(
    `UPDATE champions
     SET image_url = $2,
         image_content_hash = $3,
         image_storage_path = $4,
         updated_at = now()
     WHERE slug = $1`,
    [slug, asset.imageUrl, asset.imageContentHash, asset.imageStoragePath],
  );
}

/** Set the upstream square-portrait URL from WildRiftFire. */
export async function updateChampionThumbnailSource(
  slug: string,
  sourceUrl: string,
): Promise<void> {
  await getPool().query(
    `UPDATE champions
     SET thumbnail_source_url = $2,
         updated_at = now()
     WHERE slug = $1`,
    [slug, sourceUrl],
  );
}

/** Persist a hosted face-crop thumbnail after a successful Storage upload. */
export async function updateChampionThumbnailAsset(
  slug: string,
  asset: ChampionImageAsset,
): Promise<void> {
  await getPool().query(
    `UPDATE champions
     SET thumbnail_url = $2,
         thumbnail_content_hash = $3,
         thumbnail_storage_path = $4,
         updated_at = now()
     WHERE slug = $1`,
    [slug, asset.imageUrl, asset.imageContentHash, asset.imageStoragePath],
  );
}

/** Champions that have a thumbnail source URL and are eligible for thumbnail sync. */
export async function listChampionsNeedingThumbnailSync(
  limit?: number,
): Promise<StoredChampion[]> {
  const result = await getPool().query(
    `SELECT ${CHAMPION_COLUMNS}
     FROM champions
     WHERE thumbnail_source_url IS NOT NULL
     ORDER BY
       CASE WHEN thumbnail_storage_path IS NULL THEN 0 ELSE 1 END,
       name
     LIMIT $1`,
    [limit ?? 10_000],
  );
  return result.rows.map(mapChampionRow);
}

export async function listChampions(): Promise<StoredChampion[]> {
  const result = await getPool().query(
    `SELECT ${CHAMPION_COLUMNS}
     FROM champions
     ORDER BY name`,
  );
  return result.rows.map(mapChampionRow);
}

/** Look up a champion by slug. Returns null when missing. */
export async function getChampionBySlug(slug: string): Promise<StoredChampion | null> {
  const result = await getPool().query(
    `SELECT ${CHAMPION_COLUMNS}
     FROM champions
     WHERE slug = $1`,
    [slug],
  );
  const row = result.rows[0];
  return row ? mapChampionRow(row) : null;
}

/** Champions that have a Riot source URL and are eligible for asset sync. */
export async function listChampionsNeedingAssetSync(limit?: number): Promise<StoredChampion[]> {
  const result = await getPool().query(
    `SELECT ${CHAMPION_COLUMNS}
     FROM champions
     WHERE image_source_url IS NOT NULL
     ORDER BY
       CASE WHEN image_storage_path IS NULL THEN 0 ELSE 1 END,
       name
     LIMIT $1`,
    [limit ?? 10_000],
  );
  return result.rows.map(mapChampionRow);
}

function mapChampionRow(row: Record<string, unknown>): StoredChampion {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    title: (row.title as string) ?? null,
    roles: (row.roles as string[]) ?? [],
    difficulty: (row.difficulty as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    imageSourceUrl: (row.image_source_url as string) ?? null,
    imageContentHash: (row.image_content_hash as string) ?? null,
    imageStoragePath: (row.image_storage_path as string) ?? null,
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    thumbnailSourceUrl: (row.thumbnail_source_url as string) ?? null,
    thumbnailContentHash: (row.thumbnail_content_hash as string) ?? null,
    thumbnailStoragePath: (row.thumbnail_storage_path as string) ?? null,
  };
}
