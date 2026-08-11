import { getPatchByVersion, insertPatchWithChanges, insertRawSource } from '@wild-rift-forge/database';
import { fetchHtml } from '../fetchers/fetch-html';
import { parsePatchArticle } from '../sources/riot/patch-notes/article.parser';
import { extractPatchVersion } from '../sources/riot/patch-notes/version';
import { validateParsedPatch } from '../validators/patch.validator';
import { normalizePatch } from '../normalizers/patch.normalizer';

export const PARSER_VERSION = '1.0.0';

export interface IngestResult {
  version: string;
  inserted: boolean;
  changeCount: number;
}

/**
 * Full pipeline for one patch notes article:
 * fetch -> raw storage -> parse -> validate -> normalize -> persist.
 * Idempotent: an already-stored patch version is skipped without writes.
 */
export async function ingestPatchFromUrl(url: string, knownTitle?: string): Promise<IngestResult | null> {
  const titleForVersion = knownTitle ?? '';
  const preVersion = extractPatchVersion(titleForVersion);
  if (preVersion) {
    const existing = await getPatchByVersion(preVersion);
    if (existing) {
      console.log(`Patch ${preVersion} already stored — skipping fetch.`);
      return { version: preVersion, inserted: false, changeCount: 0 };
    }
  }

  const page = await fetchHtml(url);
  const parsed = parsePatchArticle(page.body, page.url);
  const version = extractPatchVersion(parsed.title) ?? preVersion;
  if (!version) {
    console.warn(`Could not extract a patch version from "${parsed.title}" — skipping.`);
    return null;
  }

  const existing = await getPatchByVersion(version);
  if (existing) {
    console.log(`Patch ${version} already stored — skipping.`);
    return { version, inserted: false, changeCount: 0 };
  }

  const validated = validateParsedPatch(parsed);
  const { patch, changes } = normalizePatch(validated, version);

  const rawSourceId = await insertRawSource({
    sourceType: 'riot-patch-notes',
    url: page.url,
    contentHash: page.contentHash,
    contentType: page.contentType,
    rawBody: page.body,
    parserVersion: PARSER_VERSION,
  });

  const result = await insertPatchWithChanges(patch, changes, rawSourceId);
  console.log(
    `Patch ${version}: ${result.inserted ? 'inserted' : 'already existed'} ` +
      `(${changes.length} changes, ${validated.characterChanges.length} champions).`,
  );
  return { version, inserted: result.inserted, changeCount: changes.length };
}
