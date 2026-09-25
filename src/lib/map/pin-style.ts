import type { CategoryId } from "@/lib/places/types";

/**
 * Pins speak Apple Maps' language. The big stuff (sights, parks, museums) is a
 * round photo with its name in small grey capitals below; everything else is a
 * small circle in its category color with a white glyph, the name beside it in
 * that color. Category colors are for pins and names only; a place's page,
 * sheet, and map wash keep the color sampled from its photo.
 */
export type PinKind = "photo" | "glyph";

export const PHOTO_CATEGORIES: ReadonlySet<CategoryId> = new Set<CategoryId>(["sight", "park", "museum"]);

export const pinKind = (category: CategoryId): PinKind => (PHOTO_CATEGORIES.has(category) ? "photo" : "glyph");

export interface CategoryColor {
  /** The glyph circle, and the selected balloon. */
  fill: string;
  /** The name on the light map: a deeper shade, so it reads at small sizes. */
  label: string;
  /** The name on the dark map: a lighter tint. */
  labelDark: string;
}

/** Apple Maps' category colors: food orange, café and bakery warm tones, nightlife pink, shops yellow, parks green. */
export const CATEGORY_COLORS: Record<CategoryId, CategoryColor> = {
  restaurant: { fill: "#F28A2E", label: "#C25E0B", labelDark: "#FFB36E" },
  coffee: { fill: "#B97A45", label: "#8F5627", labelDark: "#E3AE80" },
  bakery: { fill: "#E3A21A", label: "#966500", labelDark: "#F5C95E" },
  dessert: { fill: "#F07B63", label: "#C24B35", labelDark: "#FFA493" },
  bar: { fill: "#E04C8A", label: "#BD2B6B", labelDark: "#FF8FBC" },
  wine: { fill: "#B9457F", label: "#982D64", labelDark: "#F095C5" },
  shop: { fill: "#F2B705", label: "#8F6A00", labelDark: "#FFD44F" },
  sight: { fill: "#5B6BD8", label: "#4150BF", labelDark: "#A1AAFF" },
  museum: { fill: "#D9479C", label: "#B42C7C", labelDark: "#F59BCD" },
  park: { fill: "#3DAA4E", label: "#2A8739", labelDark: "#80D98B" },
};

/** Captions under photo pins: Apple's small grey capitals. */
export const CAPTION_COLOR = { light: "#6E6E73", dark: "#AEAEB2" };

/** Geometry, px. The layout, the DOM pins, and the map's collision footprints all read these. */
export const PIN = {
  /** Photo disc including its white ring. */
  photo: 36,
  photoRing: 2.5,
  /** Glyph circle. */
  glyph: 22,
  glyphIcon: 12,
  /** The selected balloon's head: the pin grows into a teardrop whose tip marks the spot. */
  photoSelected: 56,
  glyphSelected: 40,
  /** Gap between a glyph and its name, and between a photo and its caption. */
  nameGap: 5,
  captionGap: 3,
  name: { size: 12.5, lineHeight: 14, maxWidth: 96, maxLines: 3, charWidth: 6.8 },
  caption: { size: 10, lineHeight: 12, maxWidth: 92, maxLines: 2, charWidth: 7.2, tracking: 0.05 },
} as const;

/** How far a teardrop's head center sits above its tip: the rotated corner is √2 radii out. */
export const balloonLift = (head: number) => (head / 2) * Math.SQRT2;

/** Rough size of a wrapped name (or caption), for collision before it's drawn. */
export function estimateText(text: string, kind: PinKind): { width: number; height: number } {
  const spec = kind === "photo" ? PIN.caption : PIN.name;
  const lines: number[] = [];
  let line = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = word.length * spec.charWidth;
    const next = line === 0 ? w : line + spec.charWidth + w;
    if (line > 0 && next > spec.maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line > 0) lines.push(line);
  const shown = lines.slice(0, spec.maxLines);
  return {
    width: Math.min(spec.maxWidth, Math.max(0, ...shown)),
    height: Math.max(1, shown.length) * spec.lineHeight,
  };
}
