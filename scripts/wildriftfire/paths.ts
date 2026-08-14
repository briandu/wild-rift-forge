import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../..');
export const DATA_ROOT = path.join(REPO_ROOT, 'data');

export function scrapeDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function rawWrfDir(date = scrapeDate()): string {
  return path.join(DATA_ROOT, 'raw', 'wildriftfire', date);
}

export function normalizedChampionPath(id: string): string {
  return path.join(DATA_ROOT, 'normalized', 'champions', `${id}.json`);
}

export function normalizedCollectionPath(): string {
  return path.join(DATA_ROOT, 'normalized', 'champions.json');
}

export function wrfIndexPath(): string {
  return path.join(DATA_ROOT, 'raw', 'wildriftfire', 'champion-index.json');
}

export function reportsDir(): string {
  return path.join(DATA_ROOT, 'reports');
}
