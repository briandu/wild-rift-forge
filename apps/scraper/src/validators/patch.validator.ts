import { z } from 'zod';
import type { ParsedPatchArticle } from '../sources/riot/patch-notes/article.parser';

const characterChangeSchema = z.object({
  name: z.string().min(1),
  roles: z.array(z.string()),
  summaryHtml: z.string().nullable(),
  sectionTitle: z.string().nullable(),
  changes: z.array(
    z.object({
      title: z.string().min(1),
      bodyHtml: z.string().min(1),
      iconUrl: z.string().url().nullable(),
    }),
  ),
});

const richTextSectionSchema = z.object({
  title: z.string().nullable(),
  html: z.string().min(1),
});

export const parsedPatchArticleSchema = z.object({
  title: z.string().min(1),
  publishDate: z.string().nullable(),
  sourceUrl: z.string().url(),
  characterChanges: z.array(characterChangeSchema),
  richTextSections: z.array(richTextSectionSchema),
});

/**
 * Validate a parsed patch article before normalization. Throws with a
 * readable message when Riot's page structure drifts from expectations.
 */
export function validateParsedPatch(parsed: ParsedPatchArticle): ParsedPatchArticle {
  const result = parsedPatchArticleSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Parsed patch failed validation: ${result.error.message}`);
  }
  if (parsed.characterChanges.length === 0 && parsed.richTextSections.length === 0) {
    throw new Error(`Parsed patch "${parsed.title}" contains no changes at all — parser bug?`);
  }
  return result.data;
}
