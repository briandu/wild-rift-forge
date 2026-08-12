/** Minimum delay between outgoing requests — behave like a polite pipeline, not a crawler. */
const MIN_REQUEST_GAP_MS = 1500;

let lastRequestAt = 0;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait until the shared politeness gap has elapsed, then mark a request as starting. */
export async function awaitRequestSlot(): Promise<void> {
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_REQUEST_GAP_MS) {
    await sleep(MIN_REQUEST_GAP_MS - sinceLast);
  }
  lastRequestAt = Date.now();
}
