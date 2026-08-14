import { mkdir, writeFile } from 'node:fs/promises';
import { isMainModule } from './lib/is-main';
import { REPORTS_DIR, reportPath } from './lib/paths';
import { resolveApkPath, resolveTargetFlag } from './lib/resolve-apk';
import { redactSecrets } from './lib/redact';
import { scanApkEntries } from './lib/scan-apk';
import { extractUrls } from './lib/strings';

export const STRING_KEYWORDS = [
  'riotcdn',
  'riotgames',
  'riot',
  'wildrift',
  'cdn',
  'patcher',
  'patch',
  'manifest',
  'resources',
  'resource',
  'bundles',
  'bundle',
  'assets',
  'asset',
  'download',
  'update',
  'version',
  'clientconfig',
  'configuration',
  'config',
  'pad1',
  'champion',
  'character',
  'spell',
  'ability',
  'items',
  'item',
  'runes',
  'rune',
  'localization',
  'locale',
  'translation',
] as const;

const MAX_HITS_PER_KEY = 80;
const MAX_URLS = 400;
const MAX_VALUE_LEN = 240;

export interface StringHit {
  file: string;
  value: string;
  encoding: string;
}

export interface StringScanResult {
  apk: string;
  target: string;
  hits: Record<string, StringHit[]>;
  urls: StringHit[];
}

function clip(value: string): string {
  const trimmed = redactSecrets(value.replace(/\s+/g, ' ').trim());
  return trimmed.length > MAX_VALUE_LEN ? `${trimmed.slice(0, MAX_VALUE_LEN)}…` : trimmed;
}

function emptyHits(): Record<string, StringHit[]> {
  return Object.fromEntries(STRING_KEYWORDS.map((key) => [key, []])) as Record<string, StringHit[]>;
}

function consider(hits: Record<string, StringHit[]>, urls: StringHit[], file: string, value: string, encoding: string): void {
  const lower = value.toLowerCase();
  for (const key of STRING_KEYWORDS) {
    const bucket = hits[key];
    if (!bucket || bucket.length >= MAX_HITS_PER_KEY) {
      continue;
    }
    if (lower.includes(key) && !bucket.some((hit) => hit.file === file && hit.value === clip(value))) {
      bucket.push({ file, value: clip(value), encoding });
    }
  }
  for (const url of extractUrls(value)) {
    if (urls.length >= MAX_URLS) {
      break;
    }
    if (!urls.some((hit) => hit.value === url)) {
      urls.push({ file, value: url, encoding });
    }
  }
}

export function createStringCollector(apk: string, target: string): {
  consider: (file: string, value: string, encoding: string) => void;
  result: () => StringScanResult;
} {
  const hits = emptyHits();
  const urls: StringHit[] = [];
  return {
    consider: (file, value, encoding) => consider(hits, urls, file, value, encoding),
    result: () => ({ apk, target, hits, urls }),
  };
}

export async function scanApkStrings(apk: string, target: string): Promise<StringScanResult> {
  const collector = createStringCollector(apk, target);
  await scanApkEntries(apk, `${target} strings`, collector.consider);
  return collector.result();
}

export function mergeStringScans(results: StringScanResult[]): { hits: Record<string, StringHit[]>; urls: StringHit[] } {
  const hits = emptyHits();
  const urls: StringHit[] = [];
  for (const result of results) {
    for (const key of STRING_KEYWORDS) {
      const bucket = hits[key]!;
      for (const hit of result.hits[key] ?? []) {
        if (bucket.length >= MAX_HITS_PER_KEY) {
          break;
        }
        bucket.push({ ...hit, file: `${result.target}:${hit.file}` });
      }
    }
    for (const url of result.urls) {
      if (urls.length >= MAX_URLS) {
        break;
      }
      if (!urls.some((hit) => hit.value === url.value)) {
        urls.push({ ...url, file: `${result.target}:${url.file}` });
      }
    }
  }
  return { hits, urls };
}

export async function writeStringReports(merged: { hits: Record<string, StringHit[]>; urls: StringHit[] }): Promise<void> {
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(reportPath('string-hits.json'), `${JSON.stringify(merged.hits, null, 2)}\n`, 'utf8');
  await writeFile(reportPath('urls.json'), `${JSON.stringify(merged.urls, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const target = resolveTargetFlag('base');
  const { apk } = await resolveApkPath(target);
  console.log(`Scanning strings in ${target}: ${apk}`);
  const result = await scanApkStrings(apk, target);
  const urlCount = result.urls.length;
  const hitCount = Object.values(result.hits).reduce((sum, bucket) => sum + bucket.length, 0);
  await writeStringReports({ hits: result.hits, urls: result.urls });
  console.log(`${hitCount} keyword hits, ${urlCount} URLs`);
  console.log(`Wrote ${reportPath('string-hits.json')} and ${reportPath('urls.json')}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
