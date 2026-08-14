import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isMainModule } from './lib/is-main';
import { REPORTS_DIR, reportPath } from './lib/paths';
import { resolveApkPath, resolveTargetFlag } from './lib/resolve-apk';
import { listZipEntries, type ZipListEntry } from './lib/zip';

const INTERESTING_EXT = new Set([
  '.json',
  '.xml',
  '.txt',
  '.bytes',
  '.bin',
  '.dat',
  '.bundle',
  '.assets',
  '.manifest',
  '.cfg',
  '.ini',
  '.proto',
]);

function extensionOf(filePath: string): string {
  const base = path.posix.basename(filePath);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot).toLowerCase();
}

function directoryOf(filePath: string): string {
  const dir = path.posix.dirname(filePath);
  return dir === '.' ? '(root)' : dir;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface InventoryReport {
  apk: string;
  target: string;
  version: string | null;
  fileCount: number;
  directoryCount: number;
  uncompressedBytes: number;
  interesting: ZipListEntry[];
  largestFiles: ZipListEntry[];
  largestDirectories: Array<{ path: string; uncompressedBytes: number; files: number }>;
  files: ZipListEntry[];
}

export function buildInventory(apk: string, target: string, version: string | null, entries: ZipListEntry[]): InventoryReport {
  const files = entries.filter((entry) => !entry.isDirectory);
  const directories = entries.filter((entry) => entry.isDirectory);
  const dirSizes = new Map<string, { uncompressedBytes: number; files: number }>();
  for (const file of files) {
    const dir = directoryOf(file.path);
    const current = dirSizes.get(dir) ?? { uncompressedBytes: 0, files: 0 };
    current.uncompressedBytes += file.uncompressedSize;
    current.files += 1;
    dirSizes.set(dir, current);
  }
  const largestDirectories = [...dirSizes.entries()]
    .map(([dir, stats]) => ({ path: dir, ...stats }))
    .sort((a, b) => b.uncompressedBytes - a.uncompressedBytes)
    .slice(0, 25);
  return {
    apk,
    target,
    version,
    fileCount: files.length,
    directoryCount: directories.length,
    uncompressedBytes: files.reduce((sum, file) => sum + file.uncompressedSize, 0),
    interesting: files.filter((file) => INTERESTING_EXT.has(extensionOf(file.path))),
    largestFiles: [...files].sort((a, b) => b.uncompressedSize - a.uncompressedSize).slice(0, 40),
    largestDirectories,
    files,
  };
}

function toText(report: InventoryReport): string {
  const lines: string[] = [
    `APK: ${report.apk}`,
    `Target: ${report.target}`,
    `Version: ${report.version ?? 'unknown'}`,
    `Files: ${report.fileCount}`,
    `Directories: ${report.directoryCount}`,
    `Uncompressed: ${formatBytes(report.uncompressedBytes)}`,
    '',
    '== Largest files ==',
    ...report.largestFiles.map((file) => `${formatBytes(file.uncompressedSize).padStart(10)}  ${file.path}`),
    '',
    '== Largest directories ==',
    ...report.largestDirectories.map(
      (dir) => `${formatBytes(dir.uncompressedBytes).padStart(10)}  ${dir.files} files  ${dir.path}`,
    ),
    '',
    '== Interesting extensions ==',
    ...(report.interesting.length === 0
      ? ['(none)']
      : report.interesting.map((file) => `${formatBytes(file.uncompressedSize).padStart(10)}  ${file.path}`)),
    '',
    '== All files ==',
    ...report.files.map((file) => `${file.uncompressedSize}\t${file.compressedSize}\t${file.path}`),
    '',
  ];
  return lines.join('\n');
}

export async function writeInventory(apk: string, target: 'base' | 'pad1', version: string | null): Promise<InventoryReport> {
  const entries = await listZipEntries(apk);
  const report = buildInventory(apk, target, version, entries);
  const prefix = target === 'base' ? 'base-file-list' : 'pad1-file-list';
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(reportPath(`${prefix}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(reportPath(`${prefix}.txt`), toText(report), 'utf8');
  return report;
}

async function main(): Promise<void> {
  const target = resolveTargetFlag('base');
  const { apk, version } = await resolveApkPath(target);
  console.log(`Inventory ${target}: ${apk}`);
  const report = await writeInventory(apk, target, version);
  console.log(`${report.fileCount} files, ${formatBytes(report.uncompressedBytes)} uncompressed`);
  console.log(`${report.interesting.length} interesting-extension files`);
  console.log(`Wrote ${reportPath(target === 'base' ? 'base-file-list.txt' : 'pad1-file-list.txt')}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
