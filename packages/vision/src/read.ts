import {
  cropBitmap,
  findContentBounds,
  toPixelRect,
  type Bitmap,
  type Rect,
} from './bitmap';
import { colorSignature, dhash, type ColorSignature, type Hash64 } from './hash';
import {
  detectHighlightedRow,
  seedLayoutProfile,
  type LayoutProfile,
  type SlotKey,
  type SlotRole,
} from './layout';
import {
  DEFAULT_ACCEPT_CONFIDENCE,
  matchTile,
  type IconReference,
} from './match';

export type SlotRead = {
  key: SlotKey;
  role: SlotRole;
  index: number;
  /** Accepted champion, or null when nothing matched confidently. */
  slug: string | null;
  /** Best guess even when rejected, so the correction UI can pre-select it. */
  candidate: string | null;
  confidence: number;
  /** Where the tile was taken from, in coordinates of the de-letterboxed frame. */
  rect: Rect;
  hash: Hash64;
  color: ColorSignature;
};

/**
 * Which champion-select phase the frame looks like.
 *
 * This matters because during the ban phase the player rows show account avatars,
 * which are themselves champion art and would otherwise be read as locked picks.
 */
export type DraftPhase = 'ban' | 'pick' | 'unknown';

export type DraftRead = {
  slots: SlotRead[];
  /** Ally row the game highlighted, i.e. the local player. Null when unreadable. */
  mySlotIndex: number | null;
  phase: DraftPhase;
  profile: LayoutProfile;
  /** Content area used, after black bars were trimmed off the shared window. */
  contentBounds: Rect;
  /** The de-letterboxed frame, so callers can re-crop tiles without redoing work. */
  frame: Bitmap;
};

export type ReadDraftOptions = {
  profile?: LayoutProfile;
  acceptConfidence?: number;
  /** Skip letterbox trimming when the caller already normalized the frame. */
  skipTrim?: boolean;
};

function guessPhase(slots: readonly SlotRead[]): DraftPhase {
  const accepted = (role: SlotRole) =>
    slots.filter((slot) => slot.role === role && slot.slug).length;
  const enemies = accepted('enemy');
  const allies = accepted('ally');
  if (enemies >= 3) return 'pick';
  // Empty enemy rings plus a populated ally column is the signature of the ban
  // phase, where those ally portraits are avatars rather than picks.
  if (enemies === 0 && allies >= 3) return 'ban';
  return 'unknown';
}

/**
 * Identify every champion-select slot in a captured frame.
 *
 * Slots are resolved highest-confidence first, and each champion can only be used
 * once: a lobby cannot contain two Ahris, so a weaker duplicate is re-matched
 * against the remaining champions instead of silently overwriting the stronger one.
 */
export function readDraft(
  bitmap: Bitmap,
  references: readonly IconReference[],
  options: ReadDraftOptions = {},
): DraftRead {
  const { acceptConfidence = DEFAULT_ACCEPT_CONFIDENCE, skipTrim = false } = options;

  const contentBounds = skipTrim
    ? { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
    : findContentBounds(bitmap);
  const frame =
    contentBounds.x === 0 &&
    contentBounds.y === 0 &&
    contentBounds.width === bitmap.width &&
    contentBounds.height === bitmap.height
      ? bitmap
      : cropBitmap(bitmap, contentBounds);

  const profile = options.profile ?? seedLayoutProfile(frame.width, frame.height);
  const allSlugs = new Set(references.map((reference) => reference.slug));

  const tiles = profile.regions.map((region) => {
    const rect = toPixelRect(region.rect, frame.width, frame.height);
    const tile = cropBitmap(frame, rect);
    const hash = dhash(tile);
    const color = colorSignature(tile);
    const first = matchTile(hash, color, references, { acceptConfidence });
    return { region, rect, hash, color, first };
  });

  const used = new Set<string>();
  const resolved = new Map<SlotKey, SlotRead>();

  for (const tile of [...tiles].sort(
    (a, b) => (b.first.best?.confidence ?? 0) - (a.first.best?.confidence ?? 0),
  )) {
    const allow = new Set([...allSlugs].filter((slug) => !used.has(slug)));
    const result = matchTile(tile.hash, tile.color, references, { acceptConfidence, allow });
    const best = result.best;
    if (result.accepted && best) {
      used.add(best.slug);
    }
    resolved.set(tile.region.key, {
      key: tile.region.key,
      role: tile.region.role,
      index: tile.region.index,
      slug: result.accepted && best ? best.slug : null,
      candidate: best?.slug ?? null,
      confidence: best?.confidence ?? 0,
      rect: tile.rect,
      hash: tile.hash,
      color: tile.color,
    });
  }

  // Restore the profile's ordering so callers get a stable slot sequence.
  const slots = profile.regions.map((region) => resolved.get(region.key)!).filter(Boolean);
  const highlight = detectHighlightedRow(frame, profile.highlightRegions);

  return {
    slots,
    mySlotIndex: highlight?.index ?? null,
    phase: guessPhase(slots),
    profile,
    contentBounds,
    frame,
  };
}
