import NextImage, { type ImageProps } from 'next/image';
import { isSupabaseStorageSrc } from '@/lib/storage-image';

/**
 * Drop-in for next/image. Supabase Storage URLs are not rendered, so the
 * browser never requests them. Local and other remote images still optimize.
 */
export default function Image({ unoptimized, ...props }: ImageProps) {
  if (isSupabaseStorageSrc(props.src)) return null;
  return <NextImage {...props} unoptimized={unoptimized} />;
}
