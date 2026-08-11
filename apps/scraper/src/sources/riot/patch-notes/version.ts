/**
 * Extract a normalized patch version from an article title.
 *
 *   "Wild Rift Patch Notes 7.2b"  -> "7.2b"
 *   "Wild Rift Patch Notes 2.6a"  -> "2.6a"
 *   "Wild Rift Closed Beta Patch Notes" -> null (no version — caller decides)
 */
export function extractPatchVersion(title: string): string | null {
  const match = title.match(/patch notes\s+([0-9]+(?:\.[0-9]+)*[a-z]?)/i);
  return match ? match[1]!.toLowerCase() : null;
}
