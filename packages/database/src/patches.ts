import type { Patch, PatchChange } from '@wild-rift-forge/game-data';
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

export interface StoredPatchChange extends PatchChange {
  id: number;
}

export async function listPatchChanges(patchId: number): Promise<StoredPatchChange[]> {
  const result = await getPool().query(
    `SELECT id, entity_type, entity_name, change_type, ability, property,
            old_value, new_value, description, metadata
     FROM patch_changes
     WHERE patch_id = $1
     ORDER BY id`,
    [patchId],
  );
  return result.rows.map((row) => ({
    id: row.id as number,
    entityType: row.entity_type as PatchChange['entityType'],
    entityName: row.entity_name as string,
    changeType: row.change_type as PatchChange['changeType'],
    ability: (row.ability as string) ?? null,
    property: (row.property as string) ?? null,
    oldValue: row.old_value ?? null,
    newValue: row.new_value ?? null,
    description: (row.description as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
  }));
}

export interface StoredPatchAnalysis {
  patchId: number;
  model: string;
  promptHash: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function getPatchAnalysis(patchId: number): Promise<StoredPatchAnalysis | null> {
  const result = await getPool().query(
    `SELECT patch_id, model, prompt_hash, payload, created_at
     FROM patch_analyses
     WHERE patch_id = $1`,
    [patchId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    patchId: row.patch_id as number,
    model: row.model as string,
    promptHash: row.prompt_hash as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export async function upsertPatchAnalysis(input: {
  patchId: number;
  model: string;
  promptHash: string;
  payload: unknown;
}): Promise<{ inserted: boolean; updated: boolean }> {
  const result = await getPool().query<{ id: number; inserted: boolean }>(
    `INSERT INTO patch_analyses (patch_id, model, prompt_hash, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (patch_id) DO UPDATE
       SET model = EXCLUDED.model,
           prompt_hash = EXCLUDED.prompt_hash,
           payload = EXCLUDED.payload,
           updated_at = now()
     WHERE patch_analyses.prompt_hash IS DISTINCT FROM EXCLUDED.prompt_hash
     RETURNING id, (xmax = 0) AS inserted`,
    [input.patchId, input.model, input.promptHash, JSON.stringify(input.payload)],
  );
  const row = result.rows[0];
  if (!row) {
    return { inserted: false, updated: false };
  }
  return { inserted: row.inserted, updated: !row.inserted };
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
