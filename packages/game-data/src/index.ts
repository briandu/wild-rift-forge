/**
 * Canonical Wild Rift Forge game-data types.
 *
 * These types are the internal source of truth consumed by the API, web app,
 * and recommendation engine. They must know nothing about Riot's HTML or
 * page structures — the scraper normalizes source-specific data into these shapes.
 */

export type EntityType = 'champion' | 'item' | 'rune' | 'system';

export type ChangeType = 'buff' | 'nerf' | 'adjustment' | 'new' | 'rework' | 'unknown';

/** A Wild Rift patch (e.g. "7.2b"). */
export interface Patch {
  /** Normalized version string, e.g. "7.2b". Unique. */
  version: string;
  /** Human title, e.g. "Wild Rift Patch Notes 7.2b". */
  title: string;
  /** ISO date the patch notes were published. */
  releaseDate: string | null;
  /** Canonical source URL of the patch notes. */
  sourceUrl: string;
}

/** A single normalized change within a patch. History is append-only. */
export interface PatchChange {
  entityType: EntityType;
  /** Champion/item/rune name, or a section label for system changes. */
  entityName: string;
  changeType: ChangeType;
  /** Ability or section the change belongs to (e.g. "Prowl", "Base Stats"). */
  ability: string | null;
  /** The changed property, e.g. "Base Armor". */
  property: string | null;
  /** Pre-change value. Stored as jsonb; string when not further parseable. */
  oldValue: unknown | null;
  /** Post-change value. */
  newValue: unknown | null;
  /** Human-readable description preserved from the source. */
  description: string | null;
  /** Irregular extra data (source section titles, raw HTML snippets, etc.). */
  metadata: Record<string, unknown> | null;
}

/** A Wild Rift champion. */
export interface Champion {
  /** URL-safe unique identifier, e.g. "aatrox". */
  slug: string;
  name: string;
  /** Flavor title, e.g. "The Darkin Blade". */
  title: string | null;
  /** Role ids, e.g. ["fighter"]. */
  roles: string[];
  /** Difficulty label, e.g. "Medium". */
  difficulty: string | null;
  /** Public URL served to clients (hosted Storage URL once synced). */
  imageUrl: string | null;
  /** Upstream Riot CDN URL used as the download source for asset sync. */
  imageSourceUrl?: string | null;
}
