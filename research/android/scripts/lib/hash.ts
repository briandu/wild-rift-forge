import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';

export async function sha256File(filePath: string): Promise<{ sha256: string; bytes: number }> {
  const info = await stat(filePath);
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });
  return { sha256: hash.digest('hex'), bytes: info.size };
}
