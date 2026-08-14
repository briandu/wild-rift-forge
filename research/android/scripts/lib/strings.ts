const MIN_ASCII = 4;
const OVERLAP = 64;

const URL_RE = /https?:\/\/[^\s"'<>\\]+/gi;
const TEXT_EXT = new Set([
  '.json',
  '.xml',
  '.txt',
  '.html',
  '.htm',
  '.js',
  '.css',
  '.csv',
  '.cfg',
  '.ini',
  '.properties',
  '.proto',
  '.manifest',
  '.md',
  '.yml',
  '.yaml',
]);

export function isTextPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot === -1) {
    return false;
  }
  return TEXT_EXT.has(lower.slice(dot));
}

export function cleanUrl(raw: string): string {
  return raw.replace(/[),.;]+$/g, '');
}

function pushAscii(buffer: Buffer, start: number, end: number, out: string[]): void {
  if (end - start >= MIN_ASCII) {
    out.push(buffer.subarray(start, end).toString('latin1'));
  }
}

export function extractAsciiStrings(buffer: Buffer): string[] {
  const out: string[] = [];
  let start = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i]!;
    const printable = byte >= 0x20 && byte <= 0x7e;
    if (printable) {
      if (start === -1) {
        start = i;
      }
    } else if (start !== -1) {
      pushAscii(buffer, start, i, out);
      start = -1;
    }
  }
  if (start !== -1) {
    pushAscii(buffer, start, buffer.length, out);
  }
  return out;
}

export function extractUtf16leStrings(buffer: Buffer): string[] {
  const out: string[] = [];
  let start = -1;
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    const code = buffer[i]! | (buffer[i + 1]! << 8);
    const printable = code >= 0x20 && code <= 0x7e;
    if (printable) {
      if (start === -1) {
        start = i;
      }
    } else if (start !== -1) {
      const chars = (i - start) / 2;
      if (chars >= MIN_ASCII) {
        out.push(buffer.subarray(start, i).toString('utf16le'));
      }
      start = -1;
    }
  }
  if (start !== -1) {
    const chars = (buffer.length - start) / 2;
    if (chars >= MIN_ASCII) {
      out.push(buffer.subarray(start).toString('utf16le'));
    }
  }
  return out;
}

export function extractUrls(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(URL_RE)) {
    found.push(cleanUrl(match[0]));
  }
  return found;
}

export async function scanStreamStrings(
  stream: NodeJS.ReadableStream,
  onString: (value: string, encoding: 'ascii' | 'utf16le' | 'text') => void,
): Promise<void> {
  let leftover = Buffer.alloc(0);
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    const combined = leftover.length === 0 ? chunk : Buffer.concat([leftover, chunk]);
    const ascii = extractAsciiStrings(combined);
    const utf16 = extractUtf16leStrings(combined);
    for (const value of ascii) {
      onString(value, 'ascii');
    }
    for (const value of utf16) {
      onString(value, 'utf16le');
    }
    leftover = combined.subarray(Math.max(0, combined.length - OVERLAP));
  }
}

export async function scanTextStream(
  stream: NodeJS.ReadableStream,
  onString: (value: string, encoding: 'text') => void,
): Promise<void> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
    total += chunk.length;
    if (total > 8 * 1024 * 1024) {
      onString(Buffer.concat(chunks).toString('utf8'), 'text');
      chunks.length = 0;
      total = 0;
    }
  }
  if (chunks.length > 0) {
    onString(Buffer.concat(chunks).toString('utf8'), 'text');
  }
}
