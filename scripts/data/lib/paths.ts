import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../../..');
export const DATA_ROOT = path.join(REPO_ROOT, 'data');

export function rawBaselinePath(patch: string): string {
  return path.join(DATA_ROOT, 'raw', 'champions', patch, 'champion-baseline.json');
}

export function normalizedDir(patch: string): string {
  return path.join(DATA_ROOT, 'normalized', 'champions', patch);
}

export function patchRecordPath(patch: string): string {
  return path.join(DATA_ROOT, 'patches', `${patch}.json`);
}

export function overridesDir(): string {
  return path.join(DATA_ROOT, 'overrides', 'champions');
}

export function reportsDir(): string {
  return path.join(DATA_ROOT, 'reports');
}
