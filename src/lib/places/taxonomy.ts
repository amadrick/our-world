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
  { id: "coffee", label: "Coffee", plural: "Coffee" },
  { id: "bakery", label: "Bakery", plural: "Bakeries" },
  { id: "dessert", label: "Dessert", plural: "Dessert" },
  { id: "activity", label: "Activity", plural: "Activities" },
  { id: "sight", label: "Sight", plural: "Sights" },
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
  { id: "brunch", label: "Brunch", badge: "Brunch" },
  { id: "late-night", label: "Late night", badge: "Late night" },
  { id: "walkable", label: "Walkable", badge: "Walkable" },
  { id: "book-ahead", label: "Book ahead", badge: "Book ahead" },
  { id: "views", label: "Views", badge: "Views" },
  { id: "outdoors", label: "Outdoors", badge: "Outdoors" },
  { id: "groups", label: "Good for groups", badge: "Good for groups" },
];

const TAG_BY_ID = Object.fromEntries(TAGS.map((t) => [t.id, t])) as Record<
  TagId,
  TagInfo
>;

export function getTag(id: TagId): TagInfo {
  return TAG_BY_ID[id];
}
