import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  LightSpecification,
  SourceSpecification,
} from "maplibre-gl";

import { tintToward } from "@/lib/images/palette.mjs";

import { PIN, balloonLift } from "../pin-style";
import type { PinFootprint } from "../types";

export type { PinFootprint } from "../types";

/** Shared pieces the basemap themes are built from. */

export type Expr = ExpressionSpecification;
export type Scheme = "light" | "dark";
export type TileSource = "openfreemap" | "offline";
export type Palette = Record<string, string>;
/** How far each surface leans toward an open place's color, and how colorful it gets. */
export type TintTable<P extends Palette> = Partial<Record<keyof P, [mix: number, chroma: number]>>;

export type MapThemeId = "golden" | "editorial" | "dimensional" | "apple";

export interface MapTheme<P extends Palette = Palette> {
  id: MapThemeId;
  label: string;
  palettes: Record<Scheme, P>;
  tint: TintTable<P>;
  layers(C: P, ctx: StyleContext): LayerSpecification[];
  light?(C: P, ctx: StyleContext): LightSpecification;
  /** Camera tilt when the map frames a neighborhood or a place; 0 keeps it flat. */
  pitch: number;
  /** Shades the hills from the offline elevation tiles, when they're there. */
  hills?: boolean;
}

export interface StyleContext {
  tiles: TileSource;
  origin: string;
  scheme: Scheme;
  /** Hillshade elevation tiles are on this server (public/offline-terrain). */
  terrain: boolean;
}

export type Stops = [zoom: number, value: number][];

/** A width (or any number) that grows with zoom, faster the further in. */
export const ramp = (stops: Stops, base = 1.5): Expr =>
  ["interpolate", ["exponential", base], ["zoom"], ...stops.flat()] as Expr;

/** A color or number stepping linearly through zooms. */
export const byZoom = (...stops: (number | string)[]): Expr =>
  ["interpolate", ["linear"], ["zoom"], ...stops] as Expr;

export const classIn = (classes: readonly string[]): Expr =>
  ["match", ["get", "class"], [...classes], true, false] as Expr;
export const isLine: Expr = ["==", ["geometry-type"], "LineString"];
export const isPolygon: Expr = ["==", ["geometry-type"], "Polygon"];
export const notTunnel: Expr = ["!=", ["coalesce", ["get", "brunnel"], ""], "tunnel"];
export const isBridge: Expr = ["==", ["coalesce", ["get", "brunnel"], ""], "bridge"];
export const named: Expr = ["has", "name"];

export const ROAD_GROUPS = {
  service: ["service"],
  minor: ["minor"],
  medium: ["secondary", "tertiary"],
  major: ["trunk", "primary"],
  motorway: ["motorway"],
} as const;
export type RoadGroup = keyof typeof ROAD_GROUPS;
export const ROAD_ORDER: RoadGroup[] = ["service", "minor", "medium", "major", "motorway"];
export const ROAD_MIN_ZOOM: Record<RoadGroup, number> = {
  service: 14,
  minor: 12,
  medium: 10,
  major: 8,
  motorway: 6,
};

/** Street widths by class, px at each zoom: the road network's hierarchy. */
export const ROAD_WIDTH: Record<RoadGroup, Stops> = {
  motorway: [[7, 0.5], [10, 1.2], [13, 2.6], [15, 6], [17, 14], [19, 30]],
  major: [[9, 0.4], [11, 0.8], [13, 2], [15, 5.5], [17, 12], [19, 26]],
  medium: [[10, 0.3], [12, 0.7], [13, 1.4], [15, 4], [17, 9], [19, 20]],
  minor: [[12, 0.3], [13, 0.7], [15, 2.6], [17, 7], [19, 16]],
  service: [[14, 0.5], [15, 1.2], [17, 4], [19, 9]],
};

export const scaleStops = (stops: Stops, k: number): Stops => stops.map(([z, w]) => [z, w * k]);

export const roadFilter = (group: RoadGroup, extra: Expr[] = []): FilterSpecification =>
  ["all", isLine, notTunnel, classIn(ROAD_GROUPS[group]), ...extra] as FilterSpecification;

/** Font names used in `text-font`; each is one file in public/fonts, drawn through `font-faces`. */
export const FONT = {
  sans: ["Inter"],
  medium: ["Inter Medium"],
  mediumItalic: ["Inter Medium Italic"],
  semibold: ["Inter SemiBold"],
  bold: ["Inter Bold"],
  serif: ["Newsreader"],
  serifItalic: ["Newsreader Italic"],
};

export function fontFaces(origin: string): Record<string, string> {
  return {
    Inter: `${origin}/fonts/InterVariable.woff2`,
    "Inter Medium": `${origin}/fonts/Inter-Medium.woff2`,
    "Inter Medium Italic": `${origin}/fonts/Inter-MediumItalic.woff2`,
    "Inter SemiBold": `${origin}/fonts/Inter-SemiBold.woff2`,
    "Inter Bold": `${origin}/fonts/Inter-Bold.woff2`,
    Newsreader: `${origin}/fonts/Newsreader-Medium.woff2`,
    "Newsreader Italic": `${origin}/fonts/Newsreader-Italic.woff2`,
  };
}

export function glyphs(ctx: StyleContext): string {
  return ctx.tiles === "offline"
    ? `${ctx.origin}/offline-tiles/fonts/{fontstack}/{range}.pbf`
    : "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
}

export function basemapSource(ctx: StyleContext): SourceSpecification {
  if (ctx.tiles === "offline") {
    return {
      type: "vector",
      tiles: [`${ctx.origin}/offline-tiles/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom: 15,
      attribution:
        '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank">Protomaps</a>',
    };
  }
  return { type: "vector", url: "https://tiles.openfreemap.org/planet" };
}

export function terrainSource(ctx: StyleContext): SourceSpecification {
  return {
    type: "raster-dem",
    tiles: [`${ctx.origin}/offline-terrain/{z}/{x}/{y}.png`],
    encoding: "terrarium",
    tileSize: 256,
    minzoom: 8,
    maxzoom: 12,
    bounds: [-122.62, 37.64, -122.18, 37.94],
    attribution: '<a href="https://www.usgs.gov/3d-elevation-program" target="_blank">USGS 3DEP</a>',
  };
}

/** The palette with a faint wash of `tint`: each surface keeps its lightness, so labels read the same. */
export function tintPalette<P extends Palette>(
  palette: P,
  table: TintTable<P>,
  tint: string,
  scheme: Scheme,
): P {
  const strength = scheme === "dark" ? 1.2 : 1;
  const tinted: Palette = { ...palette };
  for (const [key, entry] of Object.entries(table) as [keyof P & string, [number, number]][]) {
    tinted[key] = tintToward(palette[key], tint, entry[0], entry[1] * strength);
  }
  return tinted as P;
}

/** Halo for labels: the surface color, nearly opaque. */
export const halo = (color: string, alpha = "eb") => `${color}${alpha}`;

/*
 * Pins are DOM markers over the canvas, so MapLibre can't see them. Each shown
 * pin also gets an invisible symbol the same size (its photo or glyph, plus
 * its name or caption when shown), placed before every other label; basemap
 * labels that would sit under a pin or its name drop out instead of fighting it.
 */
export const PIN_SOURCE = "pins";

export function pinCollection(pins: PinFootprint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pins
      .filter((pin) => pin.display !== "hidden")
      .map((pin) => ({
        type: "Feature",
        id: pin.id,
        geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
        properties: { kind: pin.kind, named: pin.display === "named", selected: pin.selected, name: pin.name },
      })),
  };
}

const byPin = <T>(photo: T, photoSelected: T, glyph: T, glyphSelected: T) =>
  [
    "case",
    ["==", ["get", "kind"], "photo"],
    ["case", ["get", "selected"], photoSelected, photo],
    ["case", ["get", "selected"], glyphSelected, glyph],
  ] as unknown as ExpressionSpecification;
const literal = (value: number[]) => ["literal", value];

export function pinFootprintLayer(): LayerSpecification {
  const { name, caption } = PIN;
  const liftPhoto = balloonLift(PIN.photoSelected);
  const liftGlyph = balloonLift(PIN.glyphSelected);
  return {
    id: "pin-footprints",
    type: "symbol",
    source: PIN_SOURCE,
    layout: {
      "icon-image": byPin(
        `blank-${PIN.photo + 4}`,
        `blank-${PIN.photoSelected + 4}`,
        `blank-${PIN.glyph + 4}`,
        `blank-${PIN.glyphSelected + 4}`,
      ),
      "icon-offset": byPin(literal([0, 0]), literal([0, -liftPhoto]), literal([0, 0]), literal([0, -liftGlyph])),
      "icon-allow-overlap": true,
      "icon-ignore-placement": false,
      "text-field": ["case", ["get", "named"], ["get", "name"], ""],
      "text-font": FONT.semibold,
      "text-size": byPin(caption.size, caption.size, name.size, name.size),
      "text-transform": byPin("uppercase", "uppercase", "none", "none"),
      "text-letter-spacing": byPin(caption.tracking, caption.tracking, 0, 0),
      "text-max-width": byPin(
        caption.maxWidth / caption.size,
        caption.maxWidth / caption.size,
        name.maxWidth / name.size,
        name.maxWidth / name.size,
      ),
      "text-line-height": 1.15,
      "text-anchor": byPin("top", "top", "left", "left"),
      "text-justify": byPin("center", "center", "left", "left"),
      // Names start just right of the glyph (or the balloon's head); captions just under the photo (or the tip).
      "text-offset": byPin(
        literal([0, (PIN.photo / 2 + PIN.captionGap) / caption.size]),
        literal([0, PIN.captionGap / caption.size]),
        literal([(PIN.glyph / 2 + PIN.nameGap) / name.size, 0]),
        literal([(PIN.glyphSelected / 2 + PIN.nameGap) / name.size, -liftGlyph / name.size]),
      ),
      "text-padding": 2,
      "text-allow-overlap": true,
      "text-ignore-placement": false,
    },
    paint: { "icon-opacity": 0, "text-opacity": 0 },
  };
}

/*
 * Small images the themes draw with, generated on demand (see
 * `missingImage`): blank collision boxes, a film-grain stipple for parks, and
 * landmark and hill markers.
 */
export interface GeneratedImage {
  width: number;
  height: number;
  data: Uint8Array;
  pixelRatio: number;
}

const parseColor = (hex: string, alpha = 1): [number, number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  Math.round(alpha * 255),
];

/**
 * Draws a generated image by id: `blank-<px>`, `stipple-<hex>-<alpha%>`,
 * `landmark-<hex>`, `peak-<hex>`, `dot-<hex>`. Unknown ids return null.
 */
export function missingImage(id: string): GeneratedImage | null {
  const dot = /^dot-([0-9a-f]{6})$/.exec(id);
  if (dot) {
    // A round marker with a white rim and a white center, like Apple's point-of-interest glyphs.
    const size = 30;
    const data = new Uint8Array(size * size * 4);
    const [r, g, b] = parseColor(`#${dot[1]}`);
    const c = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
        const outer = Math.min(1, Math.max(0, 13 - d));
        if (outer <= 0) continue;
        const fill = Math.min(1, Math.max(0, 10.5 - d)) - Math.min(1, Math.max(0, 3.5 - d));
        const white = 1 - fill;
        data.set(
          [
            Math.round(r * fill + 255 * white),
            Math.round(g * fill + 255 * white),
            Math.round(b * fill + 255 * white),
            Math.round(outer * 255),
          ],
          (y * size + x) * 4,
        );
      }
    }
    return { width: size, height: size, data, pixelRatio: 2 };
  }

  const blank = /^blank-(\d+)$/.exec(id);
  if (blank) {
    const size = Number(blank[1]);
    return { width: size, height: size, data: new Uint8Array(size * size * 4), pixelRatio: 1 };
  }

  const stipple = /^stipple-([0-9a-f]{6})-(\d+)$/.exec(id);
  if (stipple) {
    // An irregular scatter on a 12px tile at 2x, so the repeat doesn't read as a grid.
    const size = 24;
    const data = new Uint8Array(size * size * 4);
    const rgba = parseColor(`#${stipple[1]}`, Number(stipple[2]) / 100);
    const dots = [
      [3, 4], [15, 2], [9, 11], [20, 9], [5, 18], [14, 16], [22, 21], [11, 22], [1, 12], [18, 13],
    ];
    for (const [x, y] of dots) {
      for (const [dx, dy, a] of [[0, 0, 1], [1, 0, 0.5], [0, 1, 0.5], [1, 1, 0.3]] as const) {
        const i = (((y + dy) % size) * size + ((x + dx) % size)) * 4;
        data.set([rgba[0], rgba[1], rgba[2], Math.round(rgba[3] * a)], i);
      }
    }
    return { width: size, height: size, data, pixelRatio: 2 };
  }

  const marker = /^(landmark|peak)-([0-9a-f]{6})$/.exec(id);
  if (marker) {
    const size = 28;
    const data = new Uint8Array(size * size * 4);
    const [r, g, b] = parseColor(`#${marker[2]}`);
    const c = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = x + 0.5 - c;
        const py = y + 0.5 - c;
        let inside: number;
        let ring = 0;
        if (marker[1] === "landmark") {
          // A small diamond with a pale edge.
          const d = Math.abs(px) + Math.abs(py);
          inside = Math.min(1, Math.max(0, 9.5 - d));
          ring = Math.min(1, Math.max(0, 12 - d)) - inside;
        } else {
          // A small triangle, point up.
          const h = py + 7;
          const w = (h / 14) * 8;
          const edge = Math.min(w - Math.abs(px), 14 - h, h);
          inside = Math.min(1, Math.max(0, edge + 0.5));
          const outer = Math.min(w + 2.5 - Math.abs(px), 16 - h, h + 2.5);
          ring = Math.min(1, Math.max(0, outer + 0.5)) - inside;
        }
        const i = (y * size + x) * 4;
        const alpha = inside + ring;
        if (alpha <= 0) continue;
        const mix = inside / alpha;
        data.set(
          [
            Math.round(r * mix + 255 * (1 - mix)),
            Math.round(g * mix + 255 * (1 - mix)),
            Math.round(b * mix + 255 * (1 - mix)),
            Math.round(alpha * 255),
          ],
          i,
        );
      }
    }
    return { width: size, height: size, data, pixelRatio: 2 };
  }
  return null;
}

/** "#rrggbb" to the id-safe hex the generated image ids use. */
export const hexId = (hex: string) => hex.slice(1).toLowerCase();
