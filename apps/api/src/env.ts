import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load environment variables from the repo-root .env file if present.
 * Uses Node's built-in loadEnvFile — no dotenv dependency needed.
 */
export function loadEnv(): void {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  for (const candidate of [path.join(repoRoot, '.env'), path.resolve('.env')]) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // File not found — try the next candidate.
    }
  }
}
