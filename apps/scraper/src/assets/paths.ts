/** Map a response Content-Type (or URL) to a stable file extension. */
export function extensionForImage(contentType: string, sourceUrl?: string): string {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/avif':
      return 'avif';
    default:
      break;
  }

  if (sourceUrl) {
    try {
      const pathname = new URL(sourceUrl).pathname;
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      if (match) {
        const ext = match[1]!.toLowerCase();
        if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'].includes(ext)) {
          return ext === 'jpeg' ? 'jpg' : ext;
        }
      }
    } catch {
      // Ignore malformed URLs and fall through.
    }
  }

  return 'bin';
}

/** Canonical Storage object path for a champion portrait. */
export function championImageStoragePath(slug: string, extension: string): string {
  return `champions/${slug}.${extension}`;
}
