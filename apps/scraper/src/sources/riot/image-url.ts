/**
 * Sanity/rgpub image URLs accept `q` (1–100) and `fm`. Without them the CDN
 * may serve a compressed derivative that looks soft in large hero frames.
 */
export function highQualitySanityUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('rgpub.io') && !parsed.hostname.includes('sanity')) {
      return url;
    }
    parsed.searchParams.set('q', '100');
    parsed.searchParams.set('fm', 'jpg');
    return parsed.toString();
  } catch {
    return url;
  }
}
