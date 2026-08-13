import {
  listChampionsNeedingSignature,
  upsertIconSignature,
  type IconSignatureVariant,
} from '@wild-rift-forge/database';
import { colorSignature, dhash, HASH_ALGO, type Bitmap } from '@wild-rift-forge/vision';
import sharp from 'sharp';
import { fetchBinary } from '../fetchers/fetch-binary';

/**
 * Decode arbitrary hosted art into the plain RGBA buffer the vision package expects.
 *
 * Icons are squared first. The game draws a circular portrait inscribed in a square,
 * so a non-square source would otherwise be hashed at a different aspect than the
 * captured tile it has to match.
 */
async function toBitmap(bytes: Uint8Array, size = 128): Promise<Bitmap> {
  const { data, info } = await sharp(bytes)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data),
  };
}

/**
 * Hash hosted champion art into the manifest the browser uses for recognition.
 *
 * Only champions whose art changed since their last signature are fetched, so a
 * repeat run costs one query. Signatures derived from art are a starting point:
 * `captured` variants contributed by user corrections match the real game renderer
 * more closely and outrank these at match time.
 */
export async function syncIconSignatures(limit: number): Promise<void> {
  const variants: IconSignatureVariant[] = ['thumb', 'portrait'];
  let hashed = 0;
  let failed = 0;
  let pendingTotal = 0;

  for (const variant of variants) {
    const pending = await listChampionsNeedingSignature(variant, HASH_ALGO, limit);
    pendingTotal += pending.length;
    console.log(`Hashing ${pending.length} ${variant} icon(s)...`);

    for (const champion of pending) {
      try {
        const fetched = await fetchBinary(champion.sourceUrl);
        const bitmap = await toBitmap(fetched.bytes);
        await upsertIconSignature({
          championSlug: champion.slug,
          variant,
          hashAlgo: HASH_ALGO,
          hashBits: dhash(bitmap),
          colorBits: colorSignature(bitmap),
          sourceUrl: champion.sourceUrl,
          // Stored so the next run can tell whether the art itself changed.
          sourceContentHash: champion.contentHash ?? fetched.contentHash,
        });
        hashed += 1;
        console.log(`hashed    ${champion.slug} (${variant})`);
      } catch (error) {
        failed += 1;
        console.warn(`failed    ${champion.slug} (${variant}): ${String(error)}`);
      }
    }
  }

  if (pendingTotal === 0) {
    console.log('Nothing to do — every signature already matches its source art.');
    return;
  }
  console.log(`Icon signature sync complete: ${hashed} hashed, ${failed} failed.`);
}
