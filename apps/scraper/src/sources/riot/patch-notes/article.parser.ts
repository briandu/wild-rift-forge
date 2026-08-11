import { extractNextData, getBlades, type RiotBlade } from '../extract-next-data';

/**
 * Riot-shaped intermediate representation of a patch notes article.
 * This is still source-specific; the normalizer converts it into canonical
 * Wild Rift Forge PatchChange records.
 */
export interface ParsedPatchArticle {
  title: string;
  publishDate: string | null;
  sourceUrl: string;
  characterChanges: ParsedCharacterChange[];
  richTextSections: ParsedRichTextSection[];
}

export interface ParsedCharacterChange {
  /** Champion name as printed by Riot (usually uppercase, e.g. "XIN ZHAO"). */
  name: string;
  /** Role ids as printed by Riot. */
  roles: string[];
  /** Why-paragraph HTML from Riot's summary. */
  summaryHtml: string | null;
  /** Blade section this champion appeared under, e.g. "CHAMPION CHANGES". */
  sectionTitle: string | null;
  changes: Array<{
    /** Ability or stat group, e.g. "Base Stats", "Prowl". */
    title: string;
    /** HTML with change bullets, e.g. "<ul><li>Base Armor: 46 → 37</li></ul>". */
    bodyHtml: string;
  }>;
}

export interface ParsedRichTextSection {
  /** Riot fragment/section id when present, e.g. "Introduction". */
  title: string | null;
  html: string;
}

/** Blade types that carry no patch content. */
const IGNORED_BLADE_TYPES = new Set(['riotbar', 'separator', 'articleCardCarousel']);

interface CharacterChangesBlade extends RiotBlade {
  title?: string;
  characters?: Array<{
    character?: { name?: string; role?: { roles?: Array<{ id?: string }> } };
    summary?: { body?: string };
    changes?: Array<{ title?: string; description?: { body?: string } }>;
  }>;
}

interface RichTextBlade extends RiotBlade {
  fragmentId?: string;
  richText?: { body?: string };
}

interface AccordionBlade extends RiotBlade {
  groups?: Array<{ label?: string; content?: { body?: string } }>;
}

interface MastheadBlade extends RiotBlade {
  title?: string;
  publishDate?: string;
}

/**
 * Parse a patch notes article page into the Riot-shaped intermediate format.
 * Handles all blade layouts observed from patch 2.x through 7.x:
 * - `characterChanges`: structured champion balance changes
 * - `articleRichText` / `patchNotesRichText`: HTML sections (items, systems, intro)
 * - `articleRichTextAccordion`: collapsible HTML sections used in older patches
 */
export function parsePatchArticle(html: string, sourceUrl: string): ParsedPatchArticle {
  const blades = getBlades(extractNextData(html));

  let title = '';
  let publishDate: string | null = null;
  const characterChanges: ParsedCharacterChange[] = [];
  const richTextSections: ParsedRichTextSection[] = [];

  for (const blade of blades) {
    if (IGNORED_BLADE_TYPES.has(blade.type)) {
      continue;
    }
    if (blade.type === 'articleMasthead') {
      const masthead = blade as MastheadBlade;
      title = masthead.title ?? '';
      publishDate = masthead.publishDate ?? null;
    } else if (blade.type === 'characterChanges') {
      const cc = blade as CharacterChangesBlade;
      for (const entry of cc.characters ?? []) {
        const name = entry.character?.name;
        if (!name) {
          continue;
        }
        characterChanges.push({
          name,
          roles: (entry.character?.role?.roles ?? [])
            .map((role) => role.id ?? '')
            .filter(Boolean),
          summaryHtml: entry.summary?.body ?? null,
          sectionTitle: cc.title ?? null,
          changes: (entry.changes ?? [])
            .filter((change) => change.description?.body)
            .map((change) => ({
              title: change.title ?? 'General',
              bodyHtml: change.description!.body!,
            })),
        });
      }
    } else if (blade.type === 'articleRichText' || blade.type === 'patchNotesRichText') {
      const rt = blade as RichTextBlade;
      if (rt.richText?.body) {
        richTextSections.push({ title: rt.fragmentId ?? null, html: rt.richText.body });
      }
    } else if (blade.type === 'articleRichTextAccordion') {
      const accordion = blade as AccordionBlade;
      for (const group of accordion.groups ?? []) {
        if (group.content?.body) {
          richTextSections.push({ title: group.label ?? null, html: group.content.body });
        }
      }
    }
    // Unknown blade types are intentionally skipped; raw HTML is preserved in
    // raw_sources so parser upgrades can reprocess without refetching.
  }

  if (!title) {
    throw new Error(`No articleMasthead title found for ${sourceUrl}`);
  }

  return { title, publishDate, sourceUrl, characterChanges, richTextSections };
}
