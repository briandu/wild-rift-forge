import {
  insertRawSource,
  listChampions,
  listChampionsNeedingThumbnailSync,
  updateChampionThumbnailAsset,
  updateChampionThumbnailSource,
} from '@wild-rift-forge/database';
import { syncChampionThumbnail } from '../assets/sync-remote-image';
import { fetchHtml } from '../fetchers/fetch-html';
import { PARSER_VERSION } from './ingest-patch';
import { matchRosterSlug, parseWildRiftFireHome } from '../sources/wildriftfire/home.parser';
import { getSupabaseAdmin } from '../storage/supabase';

const WRF_HOME_URL = 'https://www.wildriftfire.com/';

/**
 * Scrape square face-crops from WildRiftFire tiles, then host them in Storage.
 * Splash art on image_url is left alone — these thumbnails are for avatars.
 */
export async function syncChampionThumbnails(limit: number): Promise<void> {
  getSupabaseAdmin();

  console.log('Fetching WildRiftFire champion tiles...');
  const page = await fetchHtml(WRF_HOME_URL);
  const tiles = parseWildRiftFireHome(page.body);
  console.log(`Parsed ${tiles.length} tiles.`);

  await insertRawSource({
    sourceType: 'wildriftfire-home',
    url: page.url,
    contentHash: page.contentHash,
    contentType: page.contentType,
    rawBody: page.body,
    parserVersion: PARSER_VERSION,
  });

  const roster = await listChampions();
  const rosterSlugs = roster.map((champion) => champion.slug);
  let matched = 0;
  let unmatched = 0;
  for (const tile of tiles) {
    const slug = matchRosterSlug(tile.slug, rosterSlugs);
    if (!slug) {
      unmatched += 1;
      console.warn(`No roster match for WRF tile ${tile.slug}`);
      continue;
    }
    await updateChampionThumbnailSource(slug, tile.imageUrl);
    matched += 1;
  }
  console.log(`Thumbnail sources: ${matched} matched, ${unmatched} unmatched.`);

  const champions = await listChampionsNeedingThumbnailSync(limit);
  console.log(`Syncing thumbnail assets for ${champions.length} champion(s)...`);
  let uploaded = 0;
  let unchanged = 0;
  let failed = 0;

  for (const champion of champions) {
    if (!champion.thumbnailSourceUrl) {
      continue;
    }
    try {
      const result = await syncChampionThumbnail({
        slug: champion.slug,
        sourceUrl: champion.thumbnailSourceUrl,
        existingContentHash: champion.thumbnailContentHash,
        existingStoragePath: champion.thumbnailStoragePath,
      });
      if (result.status === 'uploaded') {
        await updateChampionThumbnailAsset(champion.slug, {
          imageUrl: result.publicUrl,
          imageContentHash: result.contentHash,
          imageStoragePath: result.storagePath,
        });
        uploaded += 1;
        console.log(`uploaded  ${champion.slug} → ${result.storagePath}`);
      } else {
        if (champion.thumbnailUrl !== result.publicUrl || !champion.thumbnailStoragePath) {
          await updateChampionThumbnailAsset(champion.slug, {
            imageUrl: result.publicUrl,
            imageContentHash: result.contentHash,
            imageStoragePath: result.storagePath,
          });
        }
        unchanged += 1;
        console.log(`unchanged ${champion.slug}`);
      }
    } catch (error) {
      failed += 1;
      console.warn(`failed    ${champion.slug}: ${String(error)}`);
    }
  }

  console.log(
    `Champion thumbnail sync complete: ${uploaded} uploaded, ${unchanged} unchanged, ${failed} failed.`,
  );
}
