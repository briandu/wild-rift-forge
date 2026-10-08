import type { ImageProps } from 'next/image';

/**
 * Public and signed Supabase Storage URLs. The Vercel image optimizer
 * re-fetches the full object on a cache miss; these are served as hosted.
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
