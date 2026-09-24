/**
 * Turns typewriter quotes into typographic ones for display, so Inter's
 * square-quote glyphs (ss08) apply. Stored text is left untouched.
 */
export function smartQuotes(text: string): string {
  return text
    .replace(/(\p{L}|\d)'(\p{L})/gu, "$1’$2")
    .replace(/(^|[\s(\[{“-])'/g, "$1‘")
    .replace(/'/g, "’")
    .replace(/(^|[\s(\[{‘-])"/g, "$1“")
    .replace(/"/g, "”");
}
