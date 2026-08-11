import * as cheerio from 'cheerio';
import type { ChangeType, Patch, PatchChange } from '@wild-rift-forge/game-data';
import type { ParsedPatchArticle } from '../sources/riot/patch-notes/article.parser';

/**
 * Convert the Riot-shaped parsed article into canonical Wild Rift Forge
 * records. Everything downstream (API, web, recommendation engine) consumes
 * this format — never Riot page structures.
 */
export function normalizePatch(
  parsed: ParsedPatchArticle,
  version: string,
): { patch: Patch; changes: PatchChange[] } {
  const patch: Patch = {
    version,
    title: parsed.title,
    releaseDate: parsed.publishDate,
    sourceUrl: parsed.sourceUrl,
  };

  const changes: PatchChange[] = [];

  for (const champion of parsed.characterChanges) {
    const entityName = toTitleCase(champion.name);
    const summary = champion.summaryHtml ? htmlToText(champion.summaryHtml) : null;
    const changeType = inferChangeType(champion.sectionTitle, summary);

    for (const section of champion.changes) {
      const bullets = extractBullets(section.bodyHtml);
      if (bullets.length === 0) {
        // No list items — keep the section text so nothing is lost.
        changes.push({
          entityType: 'champion',
          entityName,
          changeType,
          ability: section.title,
          property: null,
          oldValue: null,
          newValue: null,
          description: htmlToText(section.bodyHtml),
          metadata: buildMetadata(summary, champion.roles, champion.sectionTitle),
        });
        continue;
      }
      for (const bullet of bullets) {
        const parsedBullet = parseChangeBullet(bullet);
        changes.push({
          entityType: 'champion',
          entityName,
          changeType,
          ability: section.title,
          property: parsedBullet.property,
          oldValue: parsedBullet.oldValue,
          newValue: parsedBullet.newValue,
          description: bullet,
          metadata: buildMetadata(summary, champion.roles, champion.sectionTitle),
        });
      }
    }

    if (champion.changes.length === 0 && summary) {
      // Champion mentioned with a summary but no structured change sections.
      changes.push({
        entityType: 'champion',
        entityName,
        changeType,
        ability: null,
        property: null,
        oldValue: null,
        newValue: null,
        description: summary,
        metadata: buildMetadata(null, champion.roles, champion.sectionTitle),
      });
    }
  }

  for (const section of parsed.richTextSections) {
    const text = htmlToText(section.html);
    if (!text) {
      continue;
    }
    changes.push({
      entityType: 'system',
      entityName: section.title ?? 'General',
      changeType: 'unknown',
      ability: null,
      property: null,
      oldValue: null,
      newValue: null,
      description: text,
      metadata: { sourceHtml: section.html },
    });
  }

  return { patch, changes };
}

/** "XIN ZHAO" -> "Xin Zhao", "KAI'SA" -> "Kai'Sa". */
export function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|[\s'‘’-])([a-z])/g, (_, boundary: string, letter: string) => boundary + letter.toUpperCase());
}

/**
 * Parse a single change bullet like "Base Armor: 46 → 37" into structured
 * old/new values. Bullets that don't match stay description-only — the raw
 * text is always preserved by the caller.
 */
export function parseChangeBullet(text: string): {
  property: string | null;
  oldValue: unknown | null;
  newValue: unknown | null;
} {
  const arrowMatch = text.match(/^(.*?)(?::\s*)?([^:→]+?)\s*(?:→|->)\s*(.+)$/);
  if (!arrowMatch) {
    const labelOnly = text.match(/^([^:]+):\s*(.+)$/);
    if (labelOnly) {
      return { property: labelOnly[1]!.trim(), oldValue: null, newValue: parseValue(labelOnly[2]!) };
    }
    return { property: null, oldValue: null, newValue: null };
  }
  const property = arrowMatch[1]!.replace(/:\s*$/, '').trim() || null;
  return {
    property,
    oldValue: parseValue(arrowMatch[2]!),
    newValue: parseValue(arrowMatch[3]!),
  };
}

/** "46" -> 46, "50/80/110" -> [50, 80, 110], anything else stays a string. */
export function parseValue(raw: string): unknown {
  const text = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }
  if (/^-?\d+(\.\d+)?(\s*\/\s*-?\d+(\.\d+)?)+$/.test(text)) {
    return text.split('/').map((part) => Number(part.trim()));
  }
  return text;
}

function inferChangeType(sectionTitle: string | null, summary: string | null): ChangeType {
  const haystack = `${sectionTitle ?? ''} ${summary ?? ''}`.toLowerCase();
  if (/\bbuff/.test(haystack)) {
    return 'buff';
  }
  if (/\bnerf/.test(haystack)) {
    return 'nerf';
  }
  if (/\brework/.test(haystack)) {
    return 'rework';
  }
  if (/\bnew champion\b/.test(haystack)) {
    return 'new';
  }
  return 'adjustment';
}

function extractBullets(html: string): string[] {
  const $ = cheerio.load(html);
  const bullets: string[] = [];
  $('li').each((_, element) => {
    const text = collapseWhitespace($(element).text());
    if (text) {
      bullets.push(text);
    }
  });
  return bullets;
}

function htmlToText(html: string): string {
  return collapseWhitespace(cheerio.load(html).text());
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildMetadata(
  summary: string | null,
  roles: string[],
  sectionTitle: string | null,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (summary) {
    metadata.summary = summary;
  }
  if (roles.length > 0) {
    metadata.roles = roles;
  }
  if (sectionTitle) {
    metadata.sourceSection = sectionTitle;
  }
  return metadata;
}
