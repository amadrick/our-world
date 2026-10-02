import { openState } from "./hours";
import { isFavorite } from "./taxonomy";
import type { CategoryId, PillId, Place } from "./types";

export interface PlaceFilters {
  category: CategoryId | null;
  /** Our favorites and the tags; a place must match all of them. */
  pills: PillId[];
  neighborhood: string | null;
  /** Only places open right now by their listed hours; unknown hours are left out. */
  openNow: boolean;
}

export const EMPTY_FILTERS: PlaceFilters = {
  category: null,
  pills: [],
  neighborhood: null,
  openNow: false,
};

export function hasActiveFilters(filters: PlaceFilters): boolean {
  return (
    filters.category !== null ||
    filters.pills.length > 0 ||
    filters.neighborhood !== null ||
    filters.openNow
  );
}

function matchesPill(place: Place, pill: PillId): boolean {
  return pill === "favorites" ? isFavorite(place) : place.tags.includes(pill);
}

export function isOpenAt(place: Place, now: Date): boolean {
  const { kind } = openState(place.hours, now);
  return kind === "open" || kind === "always";
}

/** Category is a single choice; pills and Open now narrow the list (a place must match all of them). */
export function filterPlaces(places: Place[], filters: PlaceFilters, now: Date = new Date()): Place[] {
  return places.filter(
    (place) =>
      (filters.category === null || place.category === filters.category) &&
      (filters.neighborhood === null ||
        place.neighborhood === filters.neighborhood) &&
      filters.pills.every((pill) => matchesPill(place, pill)) &&
      (!filters.openNow || isOpenAt(place, now)),
  );
}

/**
 * How many places each pill would leave if it were on, given everything else
 * that's chosen. A pill at zero has nothing to show in this section, so the bar
 * disables it rather than let it lead to an empty list.
 */
export function pillCounts(
  places: Place[],
  filters: PlaceFilters,
  pills: readonly PillId[],
  now: Date = new Date(),
): Map<PillId, number> {
  return new Map(
    pills.map((pill) => [
      pill,
      filterPlaces(
        places,
        filters.pills.includes(pill) ? filters : { ...filters, pills: [...filters.pills, pill] },
        now,
      ).length,
    ]),
  );
}

/**
 * Pills stay on when the section changes, so a section can come up empty for
 * them. This counts the matches elsewhere, so the empty state can offer them.
 */
export function matchesInOtherSections(places: Place[], filters: PlaceFilters, now: Date = new Date()): number {
  if (filters.category === null || (filters.pills.length === 0 && !filters.openNow)) return 0;
  return filterPlaces(places, { ...filters, category: null }, now).length;
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

export function sortPlaces(places: Place[]): Place[] {
  return [...places].sort((a, b) => a.name.localeCompare(b.name));
}
