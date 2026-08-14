const MIN_REQUEST_GAP_MS = 1500;

let lastRequestAt = 0;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function awaitRequestSlot(): Promise<void> {
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_REQUEST_GAP_MS) {
    await sleep(MIN_REQUEST_GAP_MS - sinceLast);
  }
  lastRequestAt = Date.now();
}

export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
