import { isTextPath, scanStreamStrings, scanTextStream } from './strings';
import { forEachZipEntry } from './zip';

export type StringConsumer = (file: string, value: string, encoding: string) => void;

export async function scanApkEntries(apk: string, label: string, consume: StringConsumer): Promise<number> {
  let scanned = 0;
  await forEachZipEntry(apk, async (entry, openStream) => {
    scanned += 1;
    if (scanned === 1 || scanned % 50 === 0) {
      console.log(`  ${label}: scanned ${scanned} files (at ${entry.path})`);
    }
    const stream = await openStream();
    if (isTextPath(entry.path)) {
      await scanTextStream(stream, (value) => consume(entry.path, value, 'text'));
      return;
    }
    await scanStreamStrings(stream, (value, encoding) => consume(entry.path, value, encoding));
  });
  console.log(`  ${label}: finished ${scanned} files`);
  return scanned;
}
