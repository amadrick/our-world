/**
 * The list's orders. Smart, the default: open now first (closing within the
 * hour below the rest, unknown hours after, closed last), then what suits the
 * time of day, then the nearest; a favorite gets a light nudge within its
 * group, never past an open/closed line. A–Z and Nearest are one tap away.
 */
import { metersBetween } from "@/lib/geo/drive-times";
import { dayPartAt, dayPartFit } from "./day-parts";
import { CLOSING_SOON_MIN, openState, type OpenState } from "./hours";
import { isFavorite } from "./taxonomy";
import type { Place } from "./types";

export const SORT_MODES = ["smart", "az", "nearest"] as const;
export type SortMode = (typeof SORT_MODES)[number];

export const SORT_LABELS: Record<SortMode, string> = { smart: "Smart", az: "A–Z", nearest: "Nearest" };

/** Without the reader's location, distances are from Union Square. */
export const CITY_CENTER = { lat: 37.788, lng: -122.4075 } as const;

/** A fit this good counts as "good right now". */
const GOOD_FIT = 2;
/** How much a favorite's fit is nudged: enough to win a tie, not to beat a better fit. */
const FAVORITE_NUDGE = 0.5;

export type OpenTier = 0 | 1 | 2 | 3;

/** 0 open, 1 open but closing within the hour, 2 hours unknown, 3 closed. */
export function openTier(state: OpenState): OpenTier {
  if (state.kind === "always") return 0;
  if (state.kind === "open") return state.closesIn <= CLOSING_SOON_MIN ? 1 : 0;
  return state.kind === "unknown" ? 2 : 3;
}

export type SectionId = "good" | "open" | "unknown" | "closed";

export const SECTION_TITLES: Record<SectionId, string> = {
  good: "Good right now",
  open: "Also open",
  unknown: "Hours not listed",
  closed: "Closed now",
};

export interface RankedPlace {
  place: Place;
  state: OpenState;
  tier: OpenTier;
  fit: number;
  meters: number;
  section: SectionId;
}

export function rankPlaces(
  places: readonly Place[],
  { now, origin }: { now: Date; origin?: { lat: number; lng: number } | null },
): RankedPlace[] {
  const part = dayPartAt(now);
  const from = origin ?? CITY_CENTER;
  return places.map((place) => {
    const state = openState(place.hours, now);
    const tier = openTier(state);
    const fit = dayPartFit(place, part);
    const section: SectionId =
      tier === 3 ? "closed" : tier === 2 ? "unknown" : tier === 0 && fit >= GOOD_FIT ? "good" : "open";
    return { place, state, tier, fit, meters: metersBetween(from, place), section };
  });
}

const byName = (a: Place, b: Place) => a.name.localeCompare(b.name);

function smartCompare(a: RankedPlace, b: RankedPlace): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  // Open places that suit the hour come first; within "Also open", a place closing soon goes last.
  if (a.section !== b.section) return a.section === "good" ? -1 : 1;
  if (a.tier === 3) {
    const soon = (r: RankedPlace) => (r.state.kind === "closed" && r.state.opensIn !== null ? r.state.opensIn : Infinity);
    if (soon(a) !== soon(b)) return soon(a) - soon(b);
  }
  const score = (r: RankedPlace) => r.fit + (isFavorite(r.place) ? FAVORITE_NUDGE : 0);
  if (score(a) !== score(b)) return score(b) - score(a);
  if (a.meters !== b.meters) return a.meters - b.meters;
  return byName(a.place, b.place);
}

export function orderPlaces(
  places: readonly Place[],
  mode: SortMode,
  context: { now: Date; origin?: { lat: number; lng: number } | null },
): RankedPlace[] {
  const ranked = rankPlaces(places, context);
  if (mode === "az") return ranked.sort((a, b) => byName(a.place, b.place));
  if (mode === "nearest") return ranked.sort((a, b) => a.meters - b.meters || byName(a.place, b.place));
  return ranked.sort(smartCompare);
}

/** Consecutive runs of one section, for the Smart order's headings. */
export function groupBySection(ranked: readonly RankedPlace[]): { id: SectionId; items: RankedPlace[] }[] {
  const groups: { id: SectionId; items: RankedPlace[] }[] = [];
  for (const item of ranked) {
    const last = groups[groups.length - 1];
    if (last?.id === item.section) last.items.push(item);
    else groups.push({ id: item.section, items: [item] });
  }
  return groups;
}
