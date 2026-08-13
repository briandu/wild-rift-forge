import { getPool } from './client';

export type IconSignatureVariant = 'thumb' | 'portrait' | 'captured';

export type StoredIconSignature = {
  slug: string;
  variant: IconSignatureVariant;
  hashAlgo: string;
  hashBits: string;
  colorBits: string | null;
  sourceContentHash: string | null;
};

export type IconSignatureInput = {
  championSlug: string;
  variant: IconSignatureVariant;
  hashAlgo: string;
  hashBits: string;
  colorBits?: string | null;
  sourceUrl?: string | null;
  sourceContentHash?: string | null;
};

/** The manifest the browser downloads to recognise champion portraits. */
export async function listIconSignatures(hashAlgo?: string): Promise<StoredIconSignature[]> {
  const result = await getPool().query(
    `SELECT c.slug, s.variant, s.hash_algo, s.hash_bits, s.color_bits, s.source_content_hash
     FROM champion_icon_signatures s
     JOIN champions c ON c.id = s.champion_id
     WHERE ($1::text IS NULL OR s.hash_algo = $1)
     ORDER BY c.slug, s.variant`,
    [hashAlgo ?? null],
  );
  return result.rows.map((row) => ({
    slug: row.slug as string,
    variant: row.variant as IconSignatureVariant,
    hashAlgo: row.hash_algo as string,
    hashBits: row.hash_bits as string,
    colorBits: (row.color_bits as string) ?? null,
    sourceContentHash: (row.source_content_hash as string) ?? null,
  }));
}

export async function upsertIconSignature(input: IconSignatureInput): Promise<void> {
  await getPool().query(
    `INSERT INTO champion_icon_signatures
       (champion_id, variant, hash_algo, hash_bits, color_bits, source_url, source_content_hash)
     SELECT c.id, $2, $3, $4, $5, $6, $7
     FROM champions c
     WHERE c.slug = $1
     ON CONFLICT (champion_id, variant, hash_algo) DO UPDATE
       SET hash_bits = EXCLUDED.hash_bits,
           color_bits = EXCLUDED.color_bits,
           source_url = EXCLUDED.source_url,
           source_content_hash = EXCLUDED.source_content_hash,
           updated_at = now()`,
    [
      input.championSlug,
      input.variant,
      input.hashAlgo,
      input.hashBits,
      input.colorBits ?? null,
      input.sourceUrl ?? null,
      input.sourceContentHash ?? null,
    ],
  );
}

/**
 * Champions whose hosted thumbnail has not been hashed yet, or whose art changed
 * since it was. Lets the sync job skip work that would produce the same signature.
 */
export async function listChampionsNeedingSignature(
  variant: IconSignatureVariant,
  hashAlgo: string,
  limit?: number,
): Promise<Array<{ slug: string; sourceUrl: string; contentHash: string | null }>> {
  const sourceColumn = variant === 'portrait' ? 'image_url' : 'thumbnail_url';
  const hashColumn = variant === 'portrait' ? 'image_content_hash' : 'thumbnail_content_hash';
  const result = await getPool().query(
    `SELECT c.slug, c.${sourceColumn} AS source_url, c.${hashColumn} AS content_hash
     FROM champions c
     LEFT JOIN champion_icon_signatures s
       ON s.champion_id = c.id AND s.variant = $1 AND s.hash_algo = $2
     WHERE c.${sourceColumn} IS NOT NULL
       AND (
         s.id IS NULL
         OR s.source_content_hash IS DISTINCT FROM c.${hashColumn}
       )
     ORDER BY c.name
     LIMIT $3`,
    [variant, hashAlgo, limit ?? 10_000],
  );
  return result.rows.map((row) => ({
    slug: row.slug as string,
    sourceUrl: row.source_url as string,
    contentHash: (row.content_hash as string) ?? null,
  }));
}
