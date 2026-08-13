import { createHash } from 'node:crypto';
import { awaitRequestSlot, sleep } from './request-throttle';

export interface FetchedJson {
  url: string;
  body: string;
  data: unknown;
  contentType: string;
  contentHash: string;
  fetchedAt: Date;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const MAX_RETRIES = 3;

/**
 * Fetch JSON (or a .js file that is JSON) with retries and the shared politeness gap.
 */
export async function fetchJson(url: string): Promise<FetchedJson> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await awaitRequestSlot();
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json,text/plain,*/*' },
        redirect: 'follow',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const body = await response.text();
      return {
        url: response.url || url,
        body,
        data: JSON.parse(body) as unknown,
        contentType: response.headers.get('content-type') ?? 'application/json',
        contentHash: createHash('sha256').update(body).digest('hex'),
        fetchedAt: new Date(),
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** attempt);
      }
    }
  }
  throw new Error(`Failed to fetch JSON ${url} after ${MAX_RETRIES} attempts: ${String(lastError)}`);
}
