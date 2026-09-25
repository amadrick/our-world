import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

import { landmarkCollection } from "./landmarks";
import { MAP_THEMES, type MapThemeId } from "./theme";
import {
  PIN_SOURCE,
  basemapSource,
  fontFaces,
  glyphs,
  pinCollection,
  terrainSource,
  tintPalette,
  type PinFootprint,
  type Scheme,
  type StyleContext,
  type TileSource,
} from "./themes/kit";

export type { PinFootprint, TileSource } from "./themes/kit";
export type ColorScheme = Scheme;

/** Paint changes (the tint coming and going) crossfade instead of snapping. */
export const TINT_FADE_MS = 450;

export interface MapStyleOptions {
  theme: MapThemeId;
  tiles: TileSource;
  origin: string;
  scheme?: ColorScheme;
  /** An open place's color: the whole map takes a faint wash of it. */
  tint?: string | null;
  /** Elevation tiles are available for hillshade. */
  terrain?: boolean;
  pins?: PinFootprint[];
}

/** Basemap labels that can repeat a photo pin's caption: a park's name, or a neighborhood that's also a sight. */
const REPEATING_LABELS = new Set(["park-label", "neighborhood-label"]);

/**
 * Leaves out basemap labels that name the same thing as a photo pin on the
 * map ("Mission Dolores Park" beside the Dolores Park pin). A park label that
 * is part of a pin's name ("Lands End" in "Lands End & Sutro Baths") counts too.
 */
function withoutRepeats(layer: LayerSpecification, names: string[]): LayerSpecification {
  if (!names.length || layer.type !== "symbol" || !REPEATING_LABELS.has(layer.id)) return layer;
  const label: ExpressionSpecification = ["to-string", ["get", "name"]];
  const repeats: ExpressionSpecification = [
    "any",
    ...names.flatMap((name): ExpressionSpecification[] => [
      ["in", name, label],
      ...(layer.id === "park-label"
        ? [["all", [">=", ["length", label], 6], ["in", label, name]] as ExpressionSpecification]
        : []),
    ]),
  ];
  const filter = (layer.filter ? ["all", layer.filter, ["!", repeats]] : ["!", repeats]) as FilterSpecification;
  return { ...layer, filter };
}

export function buildMapStyle({
  theme: themeId,
  tiles,
  origin,
  scheme = "light",
  tint = null,
  terrain = false,
  pins = [],
}: MapStyleOptions): StyleSpecification {
  const theme = MAP_THEMES[themeId];
  const base = theme.palettes[scheme];
  const C = tint ? tintPalette(base, theme.tint, tint, scheme) : base;
  const ctx: StyleContext = { tiles, origin, scheme, terrain };
  const photoNames = [
    ...new Set(pins.filter((pin) => pin.kind === "photo").flatMap((pin) => [pin.name, pin.name.replaceAll("’", "'")])),
  ];
  const layers = theme.layers(C, ctx).map((layer) => withoutRepeats(layer, photoNames));

  const sources: Record<string, SourceSpecification> = {
    basemap: basemapSource(ctx),
    landmarks: { type: "geojson", data: landmarkCollection(new Set(pins.map((pin) => pin.id))) },
    [PIN_SOURCE]: { type: "geojson", data: pinCollection(pins) },
  };
  if (layers.some((layer) => "source" in layer && layer.source === "terrain")) {
    sources.terrain = terrainSource(ctx);
  }

  return {
    version: 8,
    name: `SF Recs ${theme.label}${scheme === "dark" ? " (dark)" : ""}`,
    transition: { duration: TINT_FADE_MS, delay: 0 },
    glyphs: glyphs(ctx),
    // Labels are drawn from the same font files as the UI.
    "font-faces": fontFaces(origin),
    ...(theme.light && { light: theme.light(C, ctx) }),
    sources,
    layers,
  };
}
