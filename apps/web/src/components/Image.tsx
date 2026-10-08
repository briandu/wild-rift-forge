import NextImage, { type ImageProps } from 'next/image';
import { isSupabaseStorageSrc } from '@/lib/storage-image';

/**
 * Drop-in for next/image. Supabase Storage objects skip the optimizer so
 * Vercel does not pull the originals. Local and other remote images still optimize.
 */
export default function Image({ unoptimized, ...props }: ImageProps) {
  return <NextImage {...props} unoptimized={unoptimized || isSupabaseStorageSrc(props.src)} />;
}
