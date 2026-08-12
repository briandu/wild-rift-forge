import { fetchBinary } from '../fetchers/fetch-binary';
import { GAME_ASSETS_BUCKET, getSupabaseAdmin, publicObjectUrl } from '../storage/supabase';
import { championImageStoragePath, extensionForImage } from './paths';

export type SyncRemoteImageResult =
  | { status: 'uploaded'; contentHash: string; storagePath: string; publicUrl: string }
  | { status: 'unchanged'; contentHash: string; storagePath: string; publicUrl: string };

export interface SyncRemoteImageInput {
  /** Entity folder prefix is baked into pathBuilder. */
  sourceUrl: string;
  /** Existing SHA-256 hex, if any. */
  existingContentHash: string | null;
  /** Existing Storage path, if any (used when hash matches). */
  existingStoragePath: string | null;
  /** Build the Storage object path from the resolved file extension. */
  pathForExtension: (extension: string) => string;
}

/**
 * Download a remote image, hash it, and upload to Storage only when the bytes changed.
 */
export async function syncRemoteImage(input: SyncRemoteImageInput): Promise<SyncRemoteImageResult> {
  const fetched = await fetchBinary(input.sourceUrl);
  const extension = extensionForImage(fetched.contentType, fetched.url);
  const storagePath = input.pathForExtension(extension);

  if (
    input.existingContentHash === fetched.contentHash &&
    input.existingStoragePath === storagePath
  ) {
    return {
      status: 'unchanged',
      contentHash: fetched.contentHash,
      storagePath,
      publicUrl: publicObjectUrl(GAME_ASSETS_BUCKET, storagePath),
    };
  }

  const supabase = getSupabaseAdmin();
  const contentType = fetched.contentType.split(';')[0]?.trim() || 'application/octet-stream';
  const { error } = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .upload(storagePath, fetched.bytes, {
      contentType,
      cacheControl: '31536000',
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);
  }

  // Drop a previous object if the extension (path) changed — keep one file per champion.
  if (input.existingStoragePath && input.existingStoragePath !== storagePath) {
    await supabase.storage.from(GAME_ASSETS_BUCKET).remove([input.existingStoragePath]);
  }

  return {
    status: 'uploaded',
    contentHash: fetched.contentHash,
    storagePath,
    publicUrl: publicObjectUrl(GAME_ASSETS_BUCKET, storagePath),
  };
}

/** Convenience wrapper for champion portraits under champions/{slug}.ext. */
export async function syncChampionPortrait(input: {
  slug: string;
  sourceUrl: string;
  existingContentHash: string | null;
  existingStoragePath: string | null;
}): Promise<SyncRemoteImageResult> {
  return syncRemoteImage({
    sourceUrl: input.sourceUrl,
    existingContentHash: input.existingContentHash,
    existingStoragePath: input.existingStoragePath,
    pathForExtension: (extension) => championImageStoragePath(input.slug, extension),
  });
}
