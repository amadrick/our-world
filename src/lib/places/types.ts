export const CATEGORY_IDS = [
  "restaurant",
  "bar",
  "wine",
  "coffee",
  "bakery",
  "dessert",
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
  /** What the illustration shows: the facade, storefront, patio, or a room. Never food. */
  placeVisualSubject?: string;
  placeVisualScene?: "facade" | "interior";
  appleMapsUrl?: string;
  googleMapsUrl?: string;
  /** Clay illustration of the signature subject, e.g. "/places/tartine-bakery.webp". */
  image?: string;
  createdAt: string;
  updatedAt?: string;
}

export type PlaceInput = Omit<Place, "id" | "createdAt" | "updatedAt">;
