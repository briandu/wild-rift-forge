import {
  listChampionsNeedingAssetSync,
  updateChampionImageAsset,
} from '@wild-rift-forge/database';
import { syncChampionPortrait } from '../assets/sync-remote-image';
import { getSupabaseAdmin } from '../storage/supabase';

/**
 * Download champion portraits from Riot and host them in Supabase Storage.
 * Cheap by design: always hash remote bytes; upload only when the hash (or path) changes.
 */
export async function syncChampionAssets(limit: number): Promise<void> {
  // Fail fast with a clear env error before touching the network.
  getSupabaseAdmin();

  const champions = await listChampionsNeedingAssetSync(limit);
  if (champions.length === 0) {
    console.log('No champions with image_source_url found. Run `scrape:champions` first.');
    return;
  }

  console.log(`Syncing assets for ${champions.length} champion(s)...`);
  let uploaded = 0;
  let unchanged = 0;
  let failed = 0;

  for (const champion of champions) {
    if (!champion.imageSourceUrl) {
      continue;
    }
    try {
      const result = await syncChampionPortrait({
        slug: champion.slug,
        sourceUrl: champion.imageSourceUrl,
        existingContentHash: champion.imageContentHash,
        existingStoragePath: champion.imageStoragePath,
      });

      if (result.status === 'uploaded') {
        await updateChampionImageAsset(champion.slug, {
          imageUrl: result.publicUrl,
          imageContentHash: result.contentHash,
          imageStoragePath: result.storagePath,
        });
        uploaded += 1;
        console.log(`uploaded  ${champion.slug} → ${result.storagePath}`);
      } else {
        // Refresh public URL in DB if somehow missing, without re-uploading.
        if (champion.imageUrl !== result.publicUrl || !champion.imageStoragePath) {
          await updateChampionImageAsset(champion.slug, {
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
    `Champion asset sync complete: ${uploaded} uploaded, ${unchanged} unchanged, ${failed} failed.`,
  );
}
