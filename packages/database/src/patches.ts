import type { Patch, PatchChange } from '@wildrift-forge/game-data';
import { getPool } from './client';

export interface StoredPatch extends Patch {
  id: number;
}

export async function getPatchByVersion(version: string): Promise<StoredPatch | null> {
  const result = await getPool().query(
    `SELECT id, version, title, release_date, source_url FROM patches WHERE version = $1`,
    [version],
  );
  return result.rows[0] ? rowToPatch(result.rows[0]) : null;
}

export async function getLatestPatch(): Promise<StoredPatch | null> {
  const result = await getPool().query(
    `SELECT id, version, title, release_date, source_url
     FROM patches
     ORDER BY release_date DESC NULLS LAST, created_at DESC
     LIMIT 1`,
  );
  return result.rows[0] ? rowToPatch(result.rows[0]) : null;
}

/**
 * Insert a patch and its normalized changes in one transaction.
 * Idempotent: if the patch version already exists, nothing is written and the
 * existing patch id is returned with inserted=false. History is append-only —
 * existing patch rows are never overwritten.
 */
export async function insertPatchWithChanges(
  patch: Patch,
  changes: PatchChange[],
  rawSourceId: number,
): Promise<{ patchId: number; inserted: boolean }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(`SELECT id FROM patches WHERE version = $1`, [
      patch.version,
    ]);
    if (existing.rows[0]) {
      await client.query('ROLLBACK');
      return { patchId: existing.rows[0].id, inserted: false };
    }
    const patchResult = await client.query<{ id: number }>(
      `INSERT INTO patches (version, title, release_date, source_url, raw_source_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [patch.version, patch.title, patch.releaseDate, patch.sourceUrl, rawSourceId],
    );
    const patchId = patchResult.rows[0]!.id;
    for (const change of changes) {
      await client.query(
        `INSERT INTO patch_changes
           (patch_id, entity_type, entity_name, change_type, ability, property,
            old_value, new_value, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          patchId,
          change.entityType,
          change.entityName,
          change.changeType,
          change.ability,
          change.property,
          change.oldValue === null ? null : JSON.stringify(change.oldValue),
          change.newValue === null ? null : JSON.stringify(change.newValue),
          change.description,
          change.metadata === null ? null : JSON.stringify(change.metadata),
        ],
      );
    }
    await client.query('COMMIT');
    return { patchId, inserted: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function rowToPatch(row: Record<string, unknown>): StoredPatch {
  return {
    id: row.id as number,
    version: row.version as string,
    title: row.title as string,
    releaseDate: row.release_date ? new Date(row.release_date as string).toISOString() : null,
    sourceUrl: row.source_url as string,
  };
}
