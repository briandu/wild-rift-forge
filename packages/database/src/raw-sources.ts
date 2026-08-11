import { getPool } from './client';

export interface RawSourceInput {
  sourceType: string;
  url: string;
  contentHash: string;
  contentType: string;
  rawBody: string;
  parserVersion: string;
}

/**
 * Store a fetched source document. Deduplicates on content_hash: refetching an
 * unchanged page updates fetched_at instead of inserting a duplicate row.
 * Returns the raw_sources id.
 */
export async function insertRawSource(input: RawSourceInput): Promise<number> {
  const result = await getPool().query<{ id: number }>(
    `INSERT INTO raw_sources (source_type, url, content_hash, content_type, raw_body, parser_version)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (content_hash)
     DO UPDATE SET fetched_at = now()
     RETURNING id`,
    [input.sourceType, input.url, input.contentHash, input.contentType, input.rawBody, input.parserVersion],
  );
  return result.rows[0]!.id;
}
