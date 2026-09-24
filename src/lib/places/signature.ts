/**
 * A short caption from a researched signature subject: drops parentheticals and
 * everything after a " / " or " + " alternative, so "Spicy Ronny (pepperoni +
 * Calabrian heat / hot honey)" reads "Spicy Ronny".
 */
export function signatureShort(subject: string): string {
  return subject
    .replace(/\s*\([^)]*\)/g, "")
    .split(/\s+[/+]\s+/)[0]
    .replace(/\s+,/g, ",")
    .trim();
}
