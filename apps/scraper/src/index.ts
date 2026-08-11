import { loadEnv } from './env';
import { closePool } from '@wildrift-forge/database';
import { checkLatestPatch } from './jobs/check-latest-patch';
import { backfillPatches } from './jobs/backfill-patches';
import { syncChampions } from './jobs/sync-champions';

function getFlag(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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
    default:
      console.log('Usage: scraper <command>');
      console.log('  latest                 ingest the latest patch if new');
      console.log('  backfill --limit N     backfill up to N recent patches (default 5)');
      console.log('  champions --limit N    sync roster; fetch detail pages for N champions (default 10)');
      process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
