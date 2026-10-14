import type { ImageProps } from 'next/image';

/**
 * Public and signed Supabase Storage URLs. The site must not request these:
 * each download counts against project egress.
 */
export function isSupabaseStorageSrc(src: ImageProps['src']): boolean {
  if (typeof src !== 'string') return false;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const supabaseHost =
    host === 'supabase.co' ||
    host.endsWith('.supabase.co') ||
    host === 'supabase.in' ||
    host.endsWith('.supabase.in');
  if (!supabaseHost) return false;
  return url.pathname.includes('/storage/v1/');
}

/** Drop a Storage URL so callers fall back to local art or initials. */
export function omitStorageUrl(src?: string | null): string | undefined {
  if (!src || isSupabaseStorageSrc(src)) return undefined;
  return src;
}

const STORAGE_URL_KEYS = new Set(['imageUrl', 'thumbnailUrl', 'avatarUrl', 'thumbUrl', 'videoUrl']);

/** Remove Storage URLs from API payloads before they reach the page. */
export function stripStorageFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripStorageFields(item)) as T;
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (STORAGE_URL_KEYS.has(key) && (typeof child === 'string' || child == null)) {
      out[key] = omitStorageUrl(typeof child === 'string' ? child : null) ?? null;
      continue;
    }
    out[key] = child && typeof child === 'object' ? stripStorageFields(child) : child;
  }
  return out as T;
}
