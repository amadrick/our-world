import type { CategoryId } from "@/lib/places/types";
import type { MapThemeId } from "./themes/kit";

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

interface ByScheme {
  light: string;
  dark: string;
}

/** A basemap's pin colors. Shapes, sizes, and behavior are the same on every basemap. */
export interface PinPalette {
  categories: Record<CategoryId, CategoryColor>;
  /** The photo pins' ring and the glyphs' rim. */
  ring: ByScheme;
  /** Photo captions. */
  caption: ByScheme;
  /** The soft halo behind names and captions, close to the land. */
  halo: ByScheme;
}

/** Apple Maps' category colors: food orange, café and bakery warm tones, nightlife pink, shops yellow, parks green. */
export const APPLE_PINS: PinPalette = {
  categories: {
    restaurant: { fill: "#F28A2E", label: "#C25E0B", labelDark: "#FAAD6D" },
    coffee: { fill: "#B97A45", label: "#8F5627", labelDark: "#E3AE80" },
    bakery: { fill: "#E3A21A", label: "#966500", labelDark: "#F5C95E" },
    dessert: { fill: "#F07B63", label: "#C24B35", labelDark: "#FFA493" },
    bar: { fill: "#E04C8A", label: "#BD2B6B", labelDark: "#FF8FBC" },
    wine: { fill: "#B9457F", label: "#982D64", labelDark: "#F095C5" },
    shop: { fill: "#F2B705", label: "#8F6A00", labelDark: "#F6DF72" },
    sight: { fill: "#5B6BD8", label: "#4150BF", labelDark: "#A1AAFF" },
    museum: { fill: "#D9479C", label: "#B42C7C", labelDark: "#F98DD6" },
    park: { fill: "#3DAA4E", label: "#2A8739", labelDark: "#7DE08B" },
  },
  ring: { light: "#FFFFFF", dark: "#FFFFFF" },
  caption: { light: "#6E6E73", dark: "#DDE6F4" },
  halo: { light: "#FFFFFF", dark: "#1A2433" },
};

/**
 * The same hues printed on film stock for basemap (e): less chroma, a little
 * warmer and dustier, so they sit in the map's palette. Names hold 4.5:1 on
 * the film land (6:1 dark); the white glyph reads on every fill about as well
 * as on Apple's, the yellows least.
 */
export const FILM_PINS: PinPalette = {
  categories: {
    restaurant: { fill: "#D48D61", label: "#8C4E25", labelDark: "#DCA584" },
    coffee: { fill: "#9B785B", label: "#77583D", labelDark: "#C7AB94" },
    bakery: { fill: "#D3A766", label: "#805419", labelDark: "#CCAB7C" },
    dessert: { fill: "#CE8379", label: "#8E4C44", labelDark: "#DDA29A" },
    bar: { fill: "#BB6B85", label: "#8F475F", labelDark: "#E5A4B2" },
    wine: { fill: "#8E5470", label: "#683B5E", labelDark: "#CEABD0" },
    shop: { fill: "#CCBD74", label: "#615608", labelDark: "#BBB07C" },
    sight: { fill: "#6A6EAB", label: "#555891", labelDark: "#A8ADDE" },
    museum: { fill: "#A86893", label: "#854B73", labelDark: "#D4A0C2" },
    park: { fill: "#709663", label: "#456739", labelDark: "#9BB891" },
  },
  ring: { light: "#F8F4EC", dark: "#E4DDD1" },
  caption: { light: "#625F59", dark: "#D2CBBF" },
  halo: { light: "#E2D9CD", dark: "#33302C" },
};

const PIN_PALETTES: Partial<Record<MapThemeId, PinPalette>> = { film: FILM_PINS };

export const pinPalette = (theme: MapThemeId): PinPalette => PIN_PALETTES[theme] ?? APPLE_PINS;

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
