import { runScrape } from './scrape-champions';

if (!process.argv.includes('--id')) {
  console.error('Usage: npm run wrf:scrape-one -- --id garen');
  process.exitCode = 1;
} else {
  runScrape().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
