import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

import { tintToward } from "@/lib/images/palette.mjs";

/**
 * "Film paper": a calm, flat basemap for OpenMapTiles-schema vector tiles (what
 * OpenFreeMap serves for free, no key needed). No casings, no landuse tints, no
 * POIs: warm cream land and streets with sea-glass water and olive parks, in
 * the tones of the film photos, labeled in Inter. With a place open, the whole
 * map takes a faint wash of that place's color.
 */

export type TileSource = "openfreemap" | "offline";
export type ColorScheme = "light" | "dark";

const LIGHT = {
  land: "#F2EEE6",
  water: "#C3D1CE",
  park: "#DCDFC9",
  wood: "#D5DAC2",
  sand: "#ECE6D9",
  building: "#E8E2D6",
  road: "#FBF9F4",
  roadFar: "#E2DCD0",
  roadMid: "#EAE5DA",
  tunnel: "#F4F0E8",
  rail: "#DDD6C9",
  path: "#E3DDD1",
  label: "#8E8679",
  labelStrong: "#6F685C",
  hood: "#A39B8D",
  waterLabel: "#7E9591",
};

type Palette = typeof LIGHT;

const DARK: Palette = {
  land: "#1C1B19",
  water: "#1A2426",
  park: "#20241C",
  wood: "#1E231A",
  sand: "#23211E",
  building: "#272521",
  road: "#35332F",
  roadFar: "#252320",
  roadMid: "#2D2B27",
  tunnel: "#22201D",
  rail: "#2E2C28",
  path: "#2C2A26",
  label: "#8C877E",
  labelStrong: "#ADA89F",
  hood: "#78736A",
  waterLabel: "#6E8584",
};

/** How far each surface leans toward an open place's color, and how colorful it gets. Labels keep theirs. */
const TINT: Partial<Record<keyof Palette, [mix: number, chroma: number]>> = {
  land: [0.55, 0.02],
  sand: [0.55, 0.02],
  building: [0.55, 0.02],
  park: [0.35, 0.03],
  wood: [0.35, 0.03],
  water: [0.3, 0.03],
  road: [0.5, 0.008],
  roadFar: [0.5, 0.018],
  roadMid: [0.5, 0.014],
  tunnel: [0.5, 0.01],
  rail: [0.5, 0.018],
  path: [0.5, 0.018],
};

/** The palette with a faint wash of `tint`: each surface keeps its lightness, so labels read the same. */
export function tintPalette(palette: Palette, tint: string, scheme: ColorScheme): Palette {
  const strength = scheme === "dark" ? 1.2 : 1;
  const tinted = { ...palette };
  for (const [key, [mix, chroma]] of Object.entries(TINT) as [keyof Palette, [number, number]][]) {
    tinted[key] = tintToward(palette[key], tint, mix, chroma * strength);
  }
  return tinted;
}

const halo = (land: string) => `${land}eb`;

/** Paint changes (the tint coming and going) crossfade instead of snapping. */
export const TINT_FADE_MS = 450;

const FONT = ["Inter"];

type Stops = [zoom: number, width: number][];
type Expr = ExpressionSpecification;

function widths(stops: Stops): Expr {
  return ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flat()] as Expr;
}

const W = {
  motorway: [[7, 0.5], [10, 1.2], [13, 2.6], [15, 6], [17, 14], [19, 30]] as Stops,
  major: [[9, 0.4], [11, 0.8], [13, 2], [15, 5.5], [17, 12], [19, 26]] as Stops,
  medium: [[10, 0.3], [12, 0.7], [13, 1.4], [15, 4], [17, 9], [19, 20]] as Stops,
  minor: [[12, 0.3], [13, 0.7], [15, 2.6], [17, 7], [19, 16]] as Stops,
  service: [[14, 0.5], [15, 1.2], [17, 4], [19, 9]] as Stops,
};

const ROAD_GROUPS = {
  service: ["service"],
  minor: ["minor"],
  medium: ["secondary", "tertiary"],
  major: ["trunk", "primary"],
  motorway: ["motorway"],
} as const;

type RoadGroup = keyof typeof ROAD_GROUPS;

const MIN_ZOOM: Record<RoadGroup, number> = {
  service: 14,
  minor: 12,
  medium: 10,
  major: 8,
  motorway: 6,
};

const classIn = (classes: readonly string[]): Expr =>
  ["match", ["get", "class"], [...classes], true, false] as Expr;

const isLine: Expr = ["==", ["geometry-type"], "LineString"];

const notTunnel: Expr = ["!=", ["coalesce", ["get", "brunnel"], ""], "tunnel"];

// Far out, white streets vanish into the land; tint them until they have room to read.
const roadColor = (C: Palette): Expr => [
  "interpolate",
  ["linear"],
  ["zoom"],
  11,
  C.roadFar,
  13,
  C.roadMid,
  14.5,
  C.road,
] as Expr;

function roadLayers(C: Palette): LayerSpecification[] {
  const groups = Object.keys(ROAD_GROUPS) as RoadGroup[];
  const tunnels: LayerSpecification[] = groups.map((g) => ({
    id: `tunnel-${g}`,
    type: "line",
    source: "basemap",
    "source-layer": "transportation",
    minzoom: Math.max(MIN_ZOOM[g], 13),
    filter: ["all", isLine, ["==", ["get", "brunnel"], "tunnel"], classIn(ROAD_GROUPS[g])],
    layout: { "line-join": "round" },
    paint: { "line-color": C.tunnel, "line-width": widths(W[g]) },
  }));
  const roads: LayerSpecification[] = groups.map((g) => ({
    id: `road-${g}`,
    type: "line",
    source: "basemap",
    "source-layer": "transportation",
    minzoom: MIN_ZOOM[g],
    filter: ["all", isLine, notTunnel, classIn(ROAD_GROUPS[g])],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": roadColor(C), "line-width": widths(W[g]) },
  }));
  return [...tunnels, ...roads];
}

function source(tiles: TileSource, origin: string): SourceSpecification {
  if (tiles === "offline") {
    return {
      type: "vector",
      tiles: [`${origin}/offline-tiles/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom: 15,
      attribution:
        '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank">Protomaps</a>',
    };
  }
  return { type: "vector", url: "https://tiles.openfreemap.org/planet" };
}

const labelPaint = (C: Palette, color: string) => ({
  "text-color": color,
  "text-halo-color": halo(C.land),
  "text-halo-width": 1.2,
});

export function buildMapStyle(
  tiles: TileSource,
  origin: string,
  scheme: ColorScheme = "light",
  tint: string | null = null,
): StyleSpecification {
  const base = scheme === "dark" ? DARK : LIGHT;
  const C = tint ? tintPalette(base, tint, scheme) : base;
  const glyphs =
    tiles === "offline"
      ? `${origin}/offline-tiles/fonts/{fontstack}/{range}.pbf`
      : "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

  const layers: LayerSpecification[] = [
    { id: "background", type: "background", paint: { "background-color": C.land } },
    {
      id: "landcover-sand",
      type: "fill",
      source: "basemap",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "sand"],
      paint: { "fill-color": C.sand },
    },
    {
      id: "park",
      type: "fill",
      source: "basemap",
      "source-layer": "park",
      paint: { "fill-color": C.park },
    },
    {
      id: "landcover-green",
      type: "fill",
      source: "basemap",
      "source-layer": "landcover",
      filter: classIn(["grass", "wood", "wetland"]),
      paint: { "fill-color": ["match", ["get", "class"], "wood", C.wood, C.park] },
    },
    {
      id: "water",
      type: "fill",
      source: "basemap",
      "source-layer": "water",
      filter: notTunnel,
      paint: { "fill-color": C.water },
    },
    {
      id: "waterway",
      type: "line",
      source: "basemap",
      "source-layer": "waterway",
      minzoom: 12,
      paint: { "line-color": C.water, "line-width": widths([[12, 0.5], [16, 1.5], [18, 3]]) },
    },
    {
      id: "pier",
      type: "fill",
      source: "basemap",
      "source-layer": "transportation",
      filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "class"], "pier"]],
      paint: { "fill-color": C.land },
    },
    {
      id: "building",
      type: "fill",
      source: "basemap",
      "source-layer": "building",
      minzoom: 14.5,
      paint: {
        "fill-color": C.building,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14.5, 0, 15.5, 1],
      },
    },
    {
      id: "path",
      type: "line",
      source: "basemap",
      "source-layer": "transportation",
      minzoom: 15,
      filter: ["all", isLine, ["==", ["get", "class"], "path"], notTunnel],
      paint: {
        "line-color": C.path,
        "line-width": widths([[15, 0.8], [17, 1.6], [19, 3]]),
        "line-dasharray": [2, 1.5],
      },
    },
    {
      id: "rail",
      type: "line",
      source: "basemap",
      "source-layer": "transportation",
      minzoom: 13,
      filter: ["all", isLine, classIn(["rail", "transit"]), notTunnel],
      paint: { "line-color": C.rail, "line-width": widths([[13, 0.6], [16, 1.2], [19, 2]]) },
    },
    ...roadLayers(C),
    {
      id: "water-label",
      type: "symbol",
      source: "basemap",
      "source-layer": "water_name",
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 14, 14],
        "text-max-width": 6,
      },
      paint: labelPaint(C, C.waterLabel),
    },
    {
      id: "road-label",
      type: "symbol",
      source: "basemap",
      "source-layer": "transportation_name",
      minzoom: 14,
      filter: [
        "any",
        classIn(["motorway", "trunk", "primary", "secondary", "tertiary"]),
        ["all", classIn(["minor"]), [">=", ["zoom"], 15.5]],
      ],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10.5, 17, 12.5],
        "symbol-placement": "line",
        "text-padding": 12,
      },
      paint: labelPaint(C, C.label),
    },
    {
      id: "park-label",
      type: "symbol",
      source: "basemap",
      "source-layer": "poi",
      minzoom: 15,
      filter: ["all", ["==", ["get", "class"], "park"], ["has", "name"]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": 11.5,
        "text-max-width": 8,
        "text-padding": 8,
      },
      paint: labelPaint(C, C.hood),
    },
    {
      id: "neighborhood-label",
      type: "symbol",
      source: "basemap",
      "source-layer": "place",
      minzoom: 12,
      maxzoom: 16,
      filter: classIn(["neighbourhood", "suburb", "quarter"]),
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 15, 13],
        "text-max-width": 7,
        "text-padding": 8,
      },
      paint: labelPaint(C, C.hood),
    },
    {
      id: "city-label",
      type: "symbol",
      source: "basemap",
      "source-layer": "place",
      maxzoom: 12,
      filter: classIn(["city", "town"]),
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 11, 15],
        "text-max-width": 8,
      },
      paint: labelPaint(C, C.labelStrong),
    },
  ];

  return {
    version: 8,
    name: scheme === "dark" ? "SF Recs Film Paper (dark)" : "SF Recs Film Paper",
    transition: { duration: TINT_FADE_MS, delay: 0 },
    glyphs,
    // Labels are drawn from the same Inter Variable file as the UI.
    "font-faces": { Inter: `${origin}/fonts/InterVariable.woff2` },
    sources: { basemap: source(tiles, origin) },
    layers,
  };
}
