import { loadEnv } from './env';
import { closePool } from '@wild-rift-forge/database';
import { checkLatestPatch } from './jobs/check-latest-patch';
import { backfillPatches } from './jobs/backfill-patches';
import { syncChampions } from './jobs/sync-champions';
import { syncChampionAssets } from './jobs/sync-champion-assets';
import { syncChampionThumbnails } from './jobs/sync-champion-thumbnails';
import { syncChampionStats } from './jobs/sync-stats';
import { analyzePatch } from './jobs/analyze-patch';

function getFlag(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getStringFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  loadEnv();
  const command = process.argv[2];

  switch (command) {
    case 'latest':
      await checkLatestPatch();
      break;
    case 'backfill':
      await backfillPatches(getFlag('limit', 5));
      break;
    case 'champions':
      await syncChampions(getFlag('limit', 10));
      break;
    case 'champion-assets':
      await syncChampionAssets(getFlag('limit', 20));
      break;
    case 'champion-thumbnails':
      await syncChampionThumbnails(getFlag('limit', 200));
      break;
    case 'stats':
      await syncChampionStats();
      break;
    case 'analyze-patch':
      await analyzePatch(getStringFlag('version'));
      break;
    default:
      console.log('Usage: scraper <command>');
      console.log('  latest                      ingest the latest patch if new');
      console.log('  backfill --limit N          backfill up to N recent patches (default 5)');
      console.log(
        '  champions --limit N         sync roster; fetch detail pages for N champions (default 10)',
      );
      console.log(
        '  champion-assets --limit N   host N champion portraits in Storage (default 20; cheap hash skip)',
      );
      console.log(
        '  champion-thumbnails --limit N  scrape WildRiftFire face-crops and host N in Storage (default 200)',
      );
      console.log('  stats                       ingest Tencent CN stats and recompute tiers');
      console.log('  analyze-patch [--version V]  ChatGPT commentary for a stored patch');
      process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
