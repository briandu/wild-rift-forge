import { mkdir, writeFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { getFlag } from './lib/cli';
import { DEFAULT_VERSION, REPORTS_DIR, apkmPath, reportPath, versionInputDir } from './lib/paths';
import { extractNamedEntries, readZipEntry } from './lib/zip';

const WANTED = new Set(['info.json', 'base.apk', 'split_pad1.apk']);

async function main(): Promise<void> {
  const version = getFlag('version') ?? DEFAULT_VERSION;
  const source = getFlag('apkm') ?? apkmPath(version);
  await access(source);
  const dest = versionInputDir(version);
  await mkdir(dest, { recursive: true });
  console.log(`Unpacking ${source}`);
  const extracted = await extractNamedEntries(source, dest, WANTED);
  for (const file of extracted) {
    console.log(`  ${file}`);
  }
  const missing = [...WANTED].filter((name) => !extracted.some((file) => file.endsWith(name)));
  if (missing.length > 0) {
    throw new Error(`APKM was missing: ${missing.join(', ')}`);
  }
  try {
    const info = await readZipEntry(source, 'info.json');
    await mkdir(REPORTS_DIR, { recursive: true });
    await writeFile(reportPath('apkm-info.json'), `${info.toString('utf8').trim()}\n`, 'utf8');
    console.log(`Wrote ${reportPath('apkm-info.json')}`);
  } catch (error) {
    console.warn(`Could not copy info.json into reports: ${error instanceof Error ? error.message : error}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
