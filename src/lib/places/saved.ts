/**
 * A guest's saved places, kept on their own device. Stored as place ids (never
 * names or positions) under a versioned key, so a later format can move to a new
 * key without misreading this one.
 */
export const SAVED_KEY = "sf-recs:saved:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Ids from stored text, oldest save first. Anything unreadable is an empty list. */
export function parseSaved(raw: string | null): string[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const ids = (data as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

export function serializeSaved(ids: Iterable<string>): string {
  return JSON.stringify({ ids: [...new Set(ids)] });
}

/** Missing, blocked (private mode), or corrupt storage all read as no saves. */
export function readSaved(storage: StorageLike | null | undefined): string[] {
  try {
    return parseSaved(storage?.getItem(SAVED_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Whether the list was stored; when it wasn't, saves last until the page reloads. */
export function writeSaved(storage: StorageLike | null | undefined, ids: Iterable<string>): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVED_KEY, serializeSaved(ids));
    return true;
  } catch {
    return false;
  }
}

/** Saves for places still in the guide; ones taken out since are dropped. */
export function knownSaved(ids: Iterable<string>, known: ReadonlySet<string>): string[] {
  return [...ids].filter((id) => known.has(id));
}

export function toggleSavedId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((saved) => saved !== id) : [...ids, id];
}
