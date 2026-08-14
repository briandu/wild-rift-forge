import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeChampion, normalizePatchRecord } from './lib/normalize';
import { normalizedDir, patchRecordPath, rawBaselinePath } from './lib/paths';
import type { RawBaselineFile } from './lib/raw';

function getFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

export async function runImport(): Promise<void> {
  const patch = getFlag('patch') ?? '7.2c';
  const fromFile = getFlag('from-file');
  const dest = rawBaselinePath(patch);
  await mkdir(path.dirname(dest), { recursive: true });
  if (fromFile) {
    await copyFile(fromFile, dest);
    console.log(`Copied raw baseline → ${dest}`);
  }
  const file = JSON.parse(await readFile(dest, 'utf8')) as RawBaselineFile;
  const generatedAt = new Date().toISOString();
  const outDir = normalizedDir(patch);
  await mkdir(outDir, { recursive: true });
  for (const raw of file.champions) {
    const snapshot = normalizeChampion(raw, generatedAt);
    await writeFile(path.join(outDir, `${snapshot.id}.json`), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }
  const patchRecord = normalizePatchRecord(file, patch);
  if (patchRecord) {
    await mkdir(path.dirname(patchRecordPath(patch)), { recursive: true });
    await writeFile(patchRecordPath(patch), `${JSON.stringify(patchRecord, null, 2)}\n`, 'utf8');
  }
  console.log(`Normalized ${file.champions.length} champions into ${outDir}`);
  if (patchRecord) {
    console.log(`Wrote ${patchRecord.changes.length} official deltas to ${patchRecordPath(patch)}`);
  }
}

if (process.argv[1] && process.argv[1].includes('import-baseline')) {
  runImport().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
