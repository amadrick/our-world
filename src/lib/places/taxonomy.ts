import type { CategoryId, TagId } from "./types";

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
  { id: "wellness", label: "Wellness", plural: "Wellness" },
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
  /** Shorter label used on a single place, e.g. "Top pick" vs "Top picks". */
  badge: string;
}

export const TAGS: TagInfo[] = [
  { id: "top-pick", label: "Top picks", badge: "Top pick" },
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

/** The filter pills guests see, always all five and in this order. "Top pick" is a star, not a pill. */
export const FILTER_TAGS: TagInfo[] = (
  ["dinner", "lunch", "late-night", "brunch", "views"] as const
).map(getTag);
