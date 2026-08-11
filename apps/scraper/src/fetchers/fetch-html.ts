import { createHash } from 'node:crypto';

export interface FetchedPage {
  /** Final URL after redirects. */
  url: string;
  body: string;
  contentType: string;
  contentHash: string;
  fetchedAt: Date;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Minimum delay between outgoing requests — behave like a polite pipeline, not a crawler. */
const MIN_REQUEST_GAP_MS = 1500;
const MAX_RETRIES = 3;

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a page over plain HTTP with a browser-like User-Agent, retries with
 * backoff, and a politeness delay between consecutive requests.
 */
export async function fetchHtml(url: string): Promise<FetchedPage> {
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_REQUEST_GAP_MS) {
    await sleep(MIN_REQUEST_GAP_MS - sinceLast);
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    lastRequestAt = Date.now();
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
        redirect: 'follow',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const body = await response.text();
      return {
        url: response.url || url,
        body,
        contentType: response.headers.get('content-type') ?? 'text/html',
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
  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts: ${String(lastError)}`);
}
