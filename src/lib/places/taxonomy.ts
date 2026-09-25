import type { CategoryId, PillId, TagId } from "./types";

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  plural: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "restaurant", label: "Restaurant", plural: "Restaurants" },
  { id: "bar", label: "Bar", plural: "Bars" },
  { id: "wine", label: "Wine", plural: "Wine" },
  { id: "coffee", label: "Coffee & tea", plural: "Coffee & tea" },
  { id: "bakery", label: "Bakery", plural: "Bakeries" },
  { id: "dessert", label: "Dessert", plural: "Dessert" },
  { id: "shop", label: "Shop", plural: "Shops" },
  { id: "museum", label: "Museum", plural: "Museums" },
  { id: "park", label: "Park", plural: "Parks" },
];

const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryInfo>;

export function getCategory(id: CategoryId): CategoryInfo {
  return CATEGORY_BY_ID[id];
}

export interface TagInfo {
  id: TagId;
  label: string;
  /** Label used on a single place. */
  badge: string;
}

export const TAGS: TagInfo[] = [
  { id: "dinner", label: "Dinner", badge: "Dinner" },
  { id: "lunch", label: "Lunch", badge: "Lunch" },
  { id: "late-night", label: "Late night", badge: "Late night" },
  { id: "brunch", label: "Brunch", badge: "Brunch" },
  { id: "views", label: "Views", badge: "Views" },
];

const TAG_BY_ID = Object.fromEntries(TAGS.map((t) => [t.id, t])) as Record<
  TagId,
  TagInfo
>;

export function getTag(id: TagId): TagInfo {
  return TAG_BY_ID[id];
}

/** The tags shown on a place, in pill order. */
export const FILTER_TAGS: TagInfo[] = (
  ["dinner", "lunch", "late-night", "brunch", "views"] as const
).map(getTag);

export const ANDY_PICK = "Andy’s pick";

export interface PillInfo {
  id: PillId;
  label: string;
}

/** The filter pills guests see, always all six and in this order. */
export const FILTER_PILLS: PillInfo[] = [
  { id: "favorites", label: "Andy’s favorites" },
  ...FILTER_TAGS.map(({ id, label }) => ({ id, label })),
];

const PILL_BY_ID = Object.fromEntries(FILTER_PILLS.map((p) => [p.id, p])) as Record<
  PillId,
  PillInfo
>;

export function getPill(id: PillId): PillInfo {
  return PILL_BY_ID[id];
}
