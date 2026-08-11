import { fetchHtml } from '../fetchers/fetch-html';
import { parsePatchIndex } from '../sources/riot/patch-notes/index.parser';
import { extractPatchVersion } from '../sources/riot/patch-notes/version';
import { ingestPatchFromUrl } from './ingest-patch';

const PATCH_INDEX_URL = 'https://wildrift.leagueoflegends.com/en-us/news/tags/patch-notes/';

/**
 * Backfill historical patches, newest first. Already-stored versions are
 * skipped, so re-running continues where the last run stopped.
 */
export async function backfillPatches(limit: number): Promise<void> {
  console.log(`Backfilling up to ${limit} patches...`);
  const indexPage = await fetchHtml(PATCH_INDEX_URL);
  const entries = parsePatchIndex(indexPage.body).filter((entry) =>
    extractPatchVersion(entry.title),
  );
  console.log(`Patch index lists ${entries.length} versioned patch articles.`);

  let processed = 0;
  let inserted = 0;
  for (const entry of entries) {
    if (processed >= limit) {
      break;
    }
    processed += 1;
    try {
      const result = await ingestPatchFromUrl(entry.url, entry.title);
      if (result?.inserted) {
        inserted += 1;
      }
    } catch (error) {
      console.error(`Failed to ingest ${entry.title}: ${String(error)}`);
    }
  }
  console.log(`Backfill complete: ${inserted} new patches inserted (${processed} checked).`);
}
