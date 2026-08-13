import { fetchHtml } from '../fetchers/fetch-html';
import { parsePatchIndex } from '../sources/riot/patch-notes/index.parser';
import { extractPatchVersion } from '../sources/riot/patch-notes/version';
import { getPatchByVersion } from '@wild-rift-forge/database';
import { ingestPatchFromUrl } from './ingest-patch';

const PATCH_INDEX_URL = 'https://wildrift.leagueoflegends.com/en-us/news/tags/patch-notes/';

export interface PatchCheckResult {
  version: string;
  inserted: boolean;
}

/**
 * Check whether a new patch has been published; ingest it if so.
 * Designed to run on a schedule — exits quickly when nothing changed.
 * Prints WRF_PATCH_INSERTED for GitHub Actions to chain commentary.
 */
export async function checkLatestPatch(): Promise<PatchCheckResult> {
  console.log('Checking for the latest patch...');
  const indexPage = await fetchHtml(PATCH_INDEX_URL);
  const entries = parsePatchIndex(indexPage.body);
  const latest = entries.find((entry) => extractPatchVersion(entry.title));
  if (!latest) {
    throw new Error('No patch notes entries found on the index page');
  }

  const version = extractPatchVersion(latest.title)!;
  const existing = await getPatchByVersion(version);
  if (existing) {
    console.log(`Latest patch ${version} is already stored. Nothing to do.`);
    console.log('WRF_PATCH_INSERTED=false');
    console.log(`WRF_PATCH_VERSION=${version}`);
    return { version, inserted: false };
  }

  console.log(`New patch detected: ${version} (${latest.url})`);
  const result = await ingestPatchFromUrl(latest.url, latest.title);
  const inserted = result?.inserted ?? false;
  console.log(`WRF_PATCH_INSERTED=${inserted}`);
  console.log(`WRF_PATCH_VERSION=${version}`);
  return { version, inserted };
}
