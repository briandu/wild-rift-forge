import {
  cropBitmap,
  findContentBounds,
  meanColor,
  toPixelRect,
  type Bitmap,
  type Rect,
} from './bitmap';
import { colorSignature, dhash, type ColorSignature, type Hash64 } from './hash';
import {
  brighterColumns,
  detectHighlightedRow,
  locateBanTrays,
  locatePortraitColumns,
  seedLayoutProfile,
  withMeasuredRegions,
  type LayoutProfile,
  type SlotKey,
  type SlotRole,
} from './layout';
import {
  inferMissingLanes,
  isLockedPick,
  readLaneLabel,
  type DraftLane,
  type LaneTemplate,
} from './lanes';
import { CAPTURED_ICONS } from './captured-icons';
import {
  DEFAULT_ACCEPT_CONFIDENCE,
  matchTile,
  type IconReference,
} from './match';
import { detectPhase, type DraftPhase, type PhaseTemplate } from './phase';

export type { DraftPhase };

export type SlotRead = {
  key: SlotKey;
  role: SlotRole;
  index: number;
  /** Accepted champion, or null when nothing matched confidently. */
  slug: string | null;
  /** Best guess even when rejected, so the correction UI can pre-select it. */
  candidate: string | null;
  confidence: number;
  /** Lane printed on this row, when the HUD still shows it. */
  lane: DraftLane | null;
  /** False for empty rings and darkened pre-picks. */
  locked: boolean;
  /** True when a ban tray slot is the ⃠ glyph, not an unread champion. */
  empty: boolean;
  /** Where the tile was taken from, in coordinates of the de-letterboxed frame. */
  rect: Rect;
  hash: Hash64;
  color: ColorSignature;
};

export type DraftRead = {
  slots: SlotRead[];
  /** Ally row the game highlighted, i.e. the local player. Null when unreadable. */
  mySlotIndex: number | null;
  /** Visual ally rows mapped onto board lanes, pick-order first. */
  rowLanes: Array<DraftLane | null>;
  phase: DraftPhase;
  profile: LayoutProfile;
  /** Content area used, after black bars were trimmed off the shared window. */
  contentBounds: Rect;
  /** The de-letterboxed frame, so callers can re-crop tiles without redoing work. */
  frame: Bitmap;
  /** Original capture size, before letterbox bars were trimmed. */
  sourceWidth: number;
  sourceHeight: number;
};

export type ReadDraftOptions = {
  profile?: LayoutProfile;
  acceptConfidence?: number;
  /** Skip letterbox trimming when the caller already normalized the frame. */
  skipTrim?: boolean;
  /** Override the built-in HUD title catalog, used by tests. */
  phaseTemplates?: readonly PhaseTemplate[];
  /** Override the built-in lane-label catalog, used by tests. */
  laneTemplates?: readonly LaneTemplate[];
};

/** Unused ban slots paint a grey ⃠ glyph. Red glow around the tray can leak in. */
const EMPTY_BAN_MAX_SAT = 0.12;
const EMPTY_BAN_MAX_LUMA = 70;

function isEmptyBanTile(tile: Bitmap): boolean {
  const { r, g, b } = meanColor(tile);
  const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return sat < EMPTY_BAN_MAX_SAT && luma < EMPTY_BAN_MAX_LUMA;
}


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

  const seeded = seedLayoutProfile(frame.width, frame.height);
  const base = options.profile ?? seeded;
  // Ban trays and portrait columns move between devices and capture pipelines.
  // A seed that is off by one slot width reads the wrong champion into every
  // ban, and a 16:9 seed on a letterboxed phone frame samples the black bar.
  const measured = [
    ...(locateBanTrays(frame) ?? []),
    ...brighterColumns(frame, base, locatePortraitColumns(frame) ?? []),
  ];
  const profile: LayoutProfile = measured.length ? withMeasuredRegions(base, measured) : base;
  const laneLabelRegions = profile.laneLabelRegions?.length
    ? profile.laneLabelRegions
    : seeded.laneLabelRegions;
  const captured = new Set(CAPTURED_ICONS.map((icon) => icon.slug));
  const library = [...CAPTURED_ICONS, ...references];
  // Ban trays draw the client's own square icon, so a hosted thumbnail of the same
  // champion is only ever a worse candidate there. Portraits are a different render
  // again, so they keep every reference we have.
  const banLibrary = [
    ...CAPTURED_ICONS,
    ...references.filter((reference) => !captured.has(reference.slug)),
  ];
  const libraryFor = (role: SlotRole): readonly IconReference[] =>
    role === 'ban-ally' || role === 'ban-enemy' ? banLibrary : library;
  const allSlugs = new Set(library.map((reference) => reference.slug));

  const printedLanes = laneLabelRegions.map((region) =>
    readLaneLabel(frame, region.rect, options.laneTemplates),
  );
  const rowLanes = inferMissingLanes(printedLanes);

  const tiles = profile.regions.map((region) => {
    const rect = toPixelRect(region.rect, frame.width, frame.height);
    const tile = cropBitmap(frame, rect);
    const hash = dhash(tile);
    const color = colorSignature(tile);
    const first = matchTile(hash, color, libraryFor(region.role), { acceptConfidence });
    const emptyBan =
      (region.role === 'ban-ally' || region.role === 'ban-enemy') &&
      !first.accepted &&
      isEmptyBanTile(tile);
    const printed = region.role === 'ally' ? (printedLanes[region.index] ?? null) : null;
    const lane = region.role === 'ally' ? (rowLanes[region.index] ?? null) : null;
    const locked =
      region.role === 'ally' || region.role === 'enemy' ? isLockedPick(tile, printed) : true;
    return { region, rect, hash, color, first, lane, locked, emptyBan };
  });

  const used = new Set<string>();
  const resolved = new Map<SlotKey, SlotRead>();

  for (const tile of [...tiles].sort(
    (a, b) => (b.first.best?.confidence ?? 0) - (a.first.best?.confidence ?? 0),
  )) {
    const allow = new Set([...allSlugs].filter((slug) => !used.has(slug)));
    const result = tile.first.best
      ? matchTile(tile.hash, tile.color, libraryFor(tile.region.role), { acceptConfidence, allow })
      : tile.first;
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
      lane: tile.lane,
      locked: tile.locked,
      empty: tile.emptyBan,
      rect: tile.rect,
      hash: tile.hash,
      color: tile.color,
    });
  }

  // Restore the profile's ordering so callers get a stable slot sequence.
  const slots = profile.regions.map((region) => resolved.get(region.key)!).filter(Boolean);
  const highlight = detectHighlightedRow(frame, profile.highlightRegions);
  const titlePhase = detectPhase(frame, { templates: options.phaseTemplates });

  return {
    slots,
    mySlotIndex: highlight?.index ?? null,
    rowLanes,
    phase: titlePhase !== 'unknown' ? titlePhase : guessPhase(slots),
    profile,
    contentBounds,
    frame,
    sourceWidth: bitmap.width,
    sourceHeight: bitmap.height,
  };
}
