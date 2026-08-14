import { copyFile, link, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getFlag, hasFlag } from './lib/cli';
import { sha256File } from './lib/hash';
import {
  APKMIRROR_LISTING_URL,
  APKMIRROR_ORG,
  APKMIRROR_REPO,
  DEFAULT_VERSION,
  apkmPath,
  reportPath,
  versionInputDir,
} from './lib/paths';
import { BROWSER_USER_AGENT, awaitRequestSlot } from './lib/throttle';

interface AcquisitionRecord {
  version: string;
  source: 'apkmirror' | 'local-file';
  sourceUrl: string;
  file: string;
  sha256: string;
  bytes: number;
  fetchedAt: string;
}

const VERSION_HREF_RE = /league-of-legends-wild-rift-(\d+(?:-\d+)+)-release/g;

function listingToDotted(hyphenVersion: string): string {
  return hyphenVersion.replace(/-/g, '.');
}

function releaseUrl(version: string): string {
  const hyphen = version.replace(/\./g, '-');
  return `https://www.apkmirror.com/apk/${APKMIRROR_ORG}/${APKMIRROR_REPO}/${APKMIRROR_REPO}-${hyphen}-release/`;
}

async function fetchListingHtml(): Promise<string> {
  await awaitRequestSlot();
  const response = await fetch(APKMIRROR_LISTING_URL, {
    headers: { 'user-agent': BROWSER_USER_AGENT, accept: 'text/html' },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(
      `APKMirror listing returned HTTP ${response.status}. Use --from-file with a local APKM.`,
    );
  }
  return response.text();
}

function compareVersions(a: string, b: string): number {
  const as = a.split('.').map((part) => Number(part) || 0);
  const bs = b.split('.').map((part) => Number(part) || 0);
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i += 1) {
    const delta = (as[i] ?? 0) - (bs[i] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function versionsFromListing(html: string): string[] {
  const seen = new Set<string>();
  const versions: string[] = [];
  for (const match of html.matchAll(VERSION_HREF_RE)) {
    const dotted = listingToDotted(match[1] ?? '');
    if (dotted && !seen.has(dotted)) {
      seen.add(dotted);
      versions.push(dotted);
    }
  }
  return versions.sort((a, b) => compareVersions(b, a));
}

async function readLastAcquisition(): Promise<AcquisitionRecord | null> {
  try {
    const raw = await import('node:fs/promises').then((fs) => fs.readFile(reportPath('acquisition.json'), 'utf8'));
    return JSON.parse(raw) as AcquisitionRecord;
  } catch {
    return null;
  }
}

async function checkLatest(): Promise<void> {
  const html = await fetchListingHtml();
  const versions = versionsFromListing(html);
  if (versions.length === 0) {
    throw new Error(
      'No versions parsed from the APKMirror listing. The page may be blocked or changed. Use --from-file.',
    );
  }
  const latest = versions[0]!;
  const previous = await readLastAcquisition();
  const previousVersion = previous?.version ?? null;
  const changed = previousVersion !== latest;
  console.log(`APKMirror latest: ${latest}`);
  console.log(`Last acquired:    ${previousVersion ?? '(none)'}`);
  console.log(changed ? 'Status: newer store version available' : 'Status: up to date');
  console.log(`Release page: ${releaseUrl(latest)}`);
}

async function writeAcquisition(record: AcquisitionRecord): Promise<void> {
  await mkdir(path.dirname(reportPath('acquisition.json')), { recursive: true });
  await writeFile(reportPath('acquisition.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

async function linkOrCopy(sourcePath: string, dest: string): Promise<void> {
  try {
    await link(sourcePath, dest);
  } catch {
    await copyFile(sourcePath, dest);
  }
}

async function acquireFromFile(sourcePath: string, version: string): Promise<void> {
  const dest = apkmPath(version);
  await mkdir(versionInputDir(version), { recursive: true });
  await linkOrCopy(path.resolve(sourcePath), dest);
  const { sha256, bytes } = await sha256File(dest);
  const record: AcquisitionRecord = {
    version,
    source: 'local-file',
    sourceUrl: path.resolve(sourcePath),
    file: dest,
    sha256,
    bytes,
    fetchedAt: new Date().toISOString(),
  };
  await writeAcquisition(record);
  console.log(`Copied ${bytes} bytes to ${dest}`);
  console.log(`sha256 ${sha256}`);
}

async function acquireFromDir(sourceDir: string, version: string): Promise<void> {
  const destDir = versionInputDir(version);
  await mkdir(destDir, { recursive: true });
  const resolved = path.resolve(sourceDir);
  for (const name of ['info.json', 'base.apk', 'split_pad1.apk']) {
    await linkOrCopy(path.join(resolved, name), path.join(destDir, name));
  }
  const base = path.join(destDir, 'base.apk');
  const { sha256, bytes } = await sha256File(base);
  const record: AcquisitionRecord = {
    version,
    source: 'local-file',
    sourceUrl: resolved,
    file: destDir,
    sha256,
    bytes,
    fetchedAt: new Date().toISOString(),
  };
  await writeAcquisition(record);
  try {
    const { readFile } = await import('node:fs/promises');
    await mkdir(path.dirname(reportPath('apkm-info.json')), { recursive: true });
    const info = await readFile(path.join(destDir, 'info.json'), 'utf8');
    await writeFile(reportPath('apkm-info.json'), `${info.trim()}\n`, 'utf8');
  } catch {
    // info.json is optional metadata
  }
  console.log(`Linked unpacked APKM from ${resolved} -> ${destDir}`);
  console.log(`base.apk sha256 ${sha256} (${bytes} bytes)`);
}

async function findDownloadedApkm(dir: string): Promise<string | null> {
  const names = await readdir(dir);
  const match = names.find((name) => name.endsWith('.apkm') || name.endsWith('.xapk') || name.endsWith('.apk'));
  return match ? path.join(dir, match) : null;
}

async function acquireFromApkMirror(version: string): Promise<void> {
  const outDir = versionInputDir(version);
  await mkdir(outDir, { recursive: true });
  const expected = apkmPath(version);
  console.log(`Downloading APKMirror bundle for ${version} (this is large; local only).`);
  console.log(`If Cloudflare blocks the fetcher, download the bundle in a browser and rerun with --from-file.`);
  let downloaded = expected;
  try {
    const { APKMirrorDownloader } = await import('apkmirror-downloader');
    const downloader = new APKMirrorDownloader({ outDir });
    const result = await downloader.download(
      { org: APKMIRROR_ORG, repo: APKMIRROR_REPO },
      {
        version,
        type: 'bundle',
        outDir,
        outFile: path.basename(expected),
      },
    );
    downloaded = result.dest;
  } catch (error) {
    throw new Error(
      `APKMirror download failed: ${error instanceof Error ? error.message : String(error)}. Use --from-file with a locally saved APKM.`,
    );
  }
  downloaded = downloaded || (await findDownloadedApkm(outDir)) || expected;
  const { sha256, bytes } = await sha256File(downloaded);
  const record: AcquisitionRecord = {
    version,
    source: 'apkmirror',
    sourceUrl: releaseUrl(version),
    file: downloaded,
    sha256,
    bytes,
    fetchedAt: new Date().toISOString(),
  };
  await writeAcquisition(record);
  console.log(`Saved ${bytes} bytes to ${downloaded}`);
  console.log(`sha256 ${sha256}`);
}

async function main(): Promise<void> {
  if (hasFlag('check')) {
    await checkLatest();
    return;
  }
  const fromFile = getFlag('from-file');
  const fromDir = getFlag('from-dir');
  const version = getFlag('version') ?? DEFAULT_VERSION;
  if (fromFile) {
    await acquireFromFile(fromFile, version);
    return;
  }
  if (fromDir) {
    await acquireFromDir(fromDir, version);
    return;
  }
  if (!getFlag('version')) {
    console.log('Usage:');
    console.log('  acquire.ts --check');
    console.log('  acquire.ts --version 7.2.0.2460');
    console.log('  acquire.ts --from-file <path> --version 7.2.0.2460');
    console.log('  acquire.ts --from-dir <unpacked-apkm-dir> --version 7.2.0.2460');
    process.exitCode = 1;
    return;
  }
  await acquireFromApkMirror(version);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
