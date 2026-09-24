import type { CategoryId, TagId } from "./types";

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  plural: string;
  color: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "restaurant", label: "Restaurant", plural: "Restaurants", color: "#E0603F" },
  { id: "bar", label: "Bar", plural: "Bars", color: "#8B5CC9" },
  { id: "coffee", label: "Coffee", plural: "Coffee", color: "#B0773A" },
  { id: "activity", label: "Activity", plural: "Activities", color: "#1E9A78" },
  { id: "sight", label: "Sight", plural: "Sights", color: "#2F7BE0" },
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
  /** Shorter label used on a single place, e.g. "Andy's pick" vs "Andy's picks". */
  badge: string;
}

export const TAGS: TagInfo[] = [
  { id: "andys-pick", label: "Andy's picks", badge: "Andy's pick" },
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
