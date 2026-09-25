export const CATEGORY_IDS = [
  "restaurant",
  "bar",
  "wine",
  "coffee",
  "bakery",
  "dessert",
  "shop",
  "activity",
  "sight",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const TAG_IDS = [
  "top-pick",
  "brunch",
  "late-night",
  "walkable",
  "book-ahead",
  "views",
  "outdoors",
  "groups",
] as const;
export type TagId = (typeof TAG_IDS)[number];

/**
 * How a place's summary was produced. "placeholder" means no OpenAI key was
 * available when it was added, so the text is a generic stand-in.
 */
export type SummarySource = "ai" | "written" | "placeholder";

/**
 * What the place physically looks like, from research with sources. Appended
 * to the image prompt as reference notes so each image is of this place.
 */
export interface PlaceResearch {
  /** Immediate street context: block, corner or mid-block, neighbors, alley, pier. */
  street: string;
  /** Hill or flat, grade, waterfront, fog, view lines, trees, light. */
  terrain: string;
  /** Building type and era, materials, color, windows, awning, signage, entrance. */
  architecture: string;
  /** Anything genuinely one of a kind about the place. */
  unique: string;
  /** The 2–4 physical details a regular would recognize it by. */
  iconic: string[];
  /** Which view is more recognizable. */
  view: "facade" | "interior";
  sources: string[];
  /** What couldn't be verified. */
  unverified?: string;
}

export interface Place {
  id: string;
  name: string;
  category: CategoryId;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  tags: TagId[];
  note?: string;
  summary: string;
  summarySource: SummarySource;
  /** The dish, drink, or room the place is known for, e.g. "Morning bun". */
  signatureSubject?: string;
  /** One line on why, with where that came from (reviews, the menu, the venue). */
  signatureRationale?: string;
  placeResearch?: PlaceResearch;
  appleMapsUrl?: string;
  googleMapsUrl?: string;
  /** Square image of the place itself, e.g. "/places/tartine-bakery-1a2b3c4d.webp". */
  image?: string;
  createdAt: string;
  updatedAt?: string;
}

export type PlaceInput = Omit<Place, "id" | "createdAt" | "updatedAt">;
