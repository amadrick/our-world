import type { CategoryId, Place, TagId } from "./types";

export interface PlaceFilters {
  category: CategoryId | null;
  tags: TagId[];
  neighborhood: string | null;
}

export const EMPTY_FILTERS: PlaceFilters = {
  category: null,
  tags: [],
  neighborhood: null,
};

export function hasActiveFilters(filters: PlaceFilters): boolean {
  return (
    filters.category !== null ||
    filters.tags.length > 0 ||
    filters.neighborhood !== null
  );
}

/** Category is a single choice; tags narrow the list (a place must have all of them). */
export function filterPlaces(places: Place[], filters: PlaceFilters): Place[] {
  return places.filter(
    (place) =>
      (filters.category === null || place.category === filters.category) &&
      (filters.neighborhood === null ||
        place.neighborhood === filters.neighborhood) &&
      filters.tags.every((tag) => place.tags.includes(tag)),
  );
}

/**
 * How many places each pill would leave if it were on, given everything else
 * that's chosen. A pill at zero has nothing to show in this section, so the bar
 * disables it rather than let it lead to an empty list.
 */
export function tagCounts(
  places: Place[],
  filters: PlaceFilters,
  tags: readonly TagId[],
): Map<TagId, number> {
  return new Map(
    tags.map((tag) => [
      tag,
      filterPlaces(
        places,
        filters.tags.includes(tag) ? filters : { ...filters, tags: [...filters.tags, tag] },
      ).length,
    ]),
  );
}

/**
 * Pills stay on when the section changes, so a section can come up empty for
 * them. This counts the matches elsewhere, so the empty state can offer them.
 */
export function matchesInOtherSections(places: Place[], filters: PlaceFilters): number {
  if (filters.category === null || filters.tags.length === 0) return 0;
  return filterPlaces(places, { ...filters, category: null }).length;
}

export function neighborhoodCounts(
  places: Place[],
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const place of places) {
    if (!place.neighborhood) continue;
    counts.set(place.neighborhood, (counts.get(place.neighborhood) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Top picks first, then alphabetical, so the list feels curated rather than random. */
export function sortPlaces(places: Place[]): Place[] {
  return [...places].sort((a, b) => {
    const pickA = a.tags.includes("top-pick") ? 0 : 1;
    const pickB = b.tags.includes("top-pick") ? 0 : 1;
    return pickA - pickB || a.name.localeCompare(b.name);
  });
}
