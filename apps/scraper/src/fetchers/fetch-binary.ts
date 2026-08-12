import { createHash } from 'node:crypto';
import { awaitRequestSlot, sleep } from './request-throttle';

export interface FetchedBinary {
  /** Final URL after redirects. */
  url: string;
  bytes: Buffer;
  contentType: string;
  contentHash: string;
  fetchedAt: Date;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const MAX_RETRIES = 3;

/**
 * Download a binary asset (image) with the shared politeness throttle and retries.
 */
export async function fetchBinary(url: string): Promise<FetchedBinary> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await awaitRequestSlot();
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'image/*,*/*;q=0.8' },
        redirect: 'follow',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      return {
        url: response.url || url,
        bytes,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        contentHash: createHash('sha256').update(bytes).digest('hex'),
        fetchedAt: new Date(),
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** attempt);
      }
    }
  }
  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts: ${String(lastError)}`);
}
