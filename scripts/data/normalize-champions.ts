import { runImport } from './import-baseline';

runImport().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
