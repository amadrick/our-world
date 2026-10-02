/**
 * What suits each part of the day, for the Near you order. Tune here: a place's
 * fit is the best of its category's score and its tags' scores, 0 (no fit) to
 * 3 (just right).
 */
import { localClock } from "./hours";
import type { CategoryId, TagId } from "./types";

export const DAY_PARTS = ["early", "morning", "midday", "afternoon", "evening", "late"] as const;
export type DayPart = (typeof DAY_PARTS)[number];

/** Where each part starts, in minutes after midnight (San Francisco time). "late" runs past midnight to 5 AM. */
const STARTS: [DayPart, number][] = [
  ["early", 5 * 60],
  ["morning", 7 * 60],
  ["midday", 11 * 60],
  ["afternoon", 15 * 60],
  ["evening", 17 * 60],
  ["late", 21 * 60 + 30],
];

export function dayPartAt(now: Date): DayPart {
  const { minutes } = localClock(now);
  if (minutes < STARTS[0][1]) return "late";
  let part: DayPart = "early";
  for (const [name, start] of STARTS) if (minutes >= start) part = name;
  return part;
}

type Fit = Partial<Record<DayPart, number>>;

/** Coffee and bakeries in the morning, lunch spots and sights at midday, dinner in the evening, bars late. */
export const CATEGORY_FIT: Record<CategoryId, Fit> = {
  coffee: { early: 3, morning: 3, midday: 1, afternoon: 2 },
  bakery: { early: 3, morning: 3, midday: 1, afternoon: 2 },
  dessert: { midday: 1, afternoon: 3, evening: 2, late: 1 },
  restaurant: { midday: 1, evening: 2 },
  bar: { afternoon: 1, evening: 2, late: 3 },
  wine: { afternoon: 1, evening: 3, late: 2 },
  shop: { morning: 1, midday: 3, afternoon: 3 },
  sight: { early: 1, morning: 2, midday: 3, afternoon: 3, evening: 1 },
  museum: { morning: 2, midday: 3, afternoon: 3 },
  park: { early: 2, morning: 2, midday: 3, afternoon: 3 },
};

/** Tags from the guide (Notion): they sharpen a category, e.g. a restaurant tagged Lunch fits midday. */
export const TAG_FIT: Record<TagId, Fit> = {
  brunch: { morning: 3, midday: 2 },
  lunch: { midday: 3 },
  dinner: { evening: 3 },
  "late-night": { late: 3 },
  views: { afternoon: 1, evening: 1 },
};

export function dayPartFit(place: { category: CategoryId; tags: readonly TagId[] }, part: DayPart): number {
  const fits = [CATEGORY_FIT[place.category]?.[part] ?? 0, ...place.tags.map((tag) => TAG_FIT[tag]?.[part] ?? 0)];
  return Math.max(...fits);
}
