import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import type { Entry, ZipFile } from 'yauzl';

export interface ZipListEntry {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory: boolean;
}

function openZip(zipPath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (error, zip) => {
      if (error || !zip) {
        reject(error ?? new Error(`Failed to open zip: ${zipPath}`));
        return;
      }
      resolve(zip);
    });
  });
}

function closeZip(zip: ZipFile): Promise<void> {
  return new Promise((resolve) => {
    zip.once('close', () => resolve());
    zip.close();
  });
}

function openEntryStream(zip: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error(`Failed to read zip entry: ${entry.fileName}`));
        return;
      }
      resolve(stream);
    });
  });
}

export async function listZipEntries(zipPath: string): Promise<ZipListEntry[]> {
  const zip = await openZip(zipPath);
  const entries: ZipListEntry[] = [];
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('end', () => resolve());
    zip.on('entry', (entry: Entry) => {
      const isDirectory = entry.fileName.endsWith('/');
      entries.push({
        path: entry.fileName,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        isDirectory,
      });
      zip.readEntry();
    });
    zip.readEntry();
  });
  await closeZip(zip);
  return entries;
}

export async function extractNamedEntries(
  zipPath: string,
  destDir: string,
  wanted: ReadonlySet<string>,
): Promise<string[]> {
  await mkdir(destDir, { recursive: true });
  const zip = await openZip(zipPath);
  const extracted: string[] = [];
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('end', () => resolve());
    zip.on('entry', (entry: Entry) => {
      const baseName = path.posix.basename(entry.fileName);
      if (entry.fileName.endsWith('/') || !wanted.has(baseName)) {
        zip.readEntry();
        return;
      }
      const dest = path.join(destDir, baseName);
      openEntryStream(zip, entry)
        .then((stream) => pipeline(stream, createWriteStream(dest)))
        .then(() => {
          extracted.push(dest);
          zip.readEntry();
        })
        .catch(reject);
    });
    zip.readEntry();
  });
  await closeZip(zip);
  return extracted;
}

export async function readZipEntry(zipPath: string, entryPath: string): Promise<Buffer> {
  const zip = await openZip(zipPath);
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('end', () => reject(new Error(`Zip entry not found: ${entryPath}`)));
    zip.on('entry', (entry: Entry) => {
      if (entry.fileName !== entryPath && path.posix.basename(entry.fileName) !== entryPath) {
        zip.readEntry();
        return;
      }
      const chunks: Buffer[] = [];
      openEntryStream(zip, entry)
        .then((stream) => {
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .catch(reject);
    });
    zip.readEntry();
  });
  await closeZip(zip);
  return buffer;
}

export async function forEachZipEntry(
  zipPath: string,
  visitor: (entry: ZipListEntry, openStream: () => Promise<NodeJS.ReadableStream>) => Promise<void>,
): Promise<void> {
  const zip = await openZip(zipPath);
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('end', () => resolve());
    zip.on('entry', (entry: Entry) => {
      const listed: ZipListEntry = {
        path: entry.fileName,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        isDirectory: entry.fileName.endsWith('/'),
      };
      const work = listed.isDirectory
        ? Promise.resolve()
        : visitor(listed, () => openEntryStream(zip, entry));
      work.then(() => zip.readEntry()).catch(reject);
    });
    zip.readEntry();
  });
  await closeZip(zip);
}
