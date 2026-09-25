import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

/**
 * "Paper": a calm, flat basemap for OpenMapTiles-schema vector tiles (what
 * OpenFreeMap serves for free, no key needed). No casings, no landuse tints, no
 * POIs: soft neutral land and streets with a whisper of blue water and sage
 * parks for the glass UI to pick up, labeled in Inter.
 */

export type TileSource = "openfreemap" | "offline";
export type ColorScheme = "light" | "dark";

const LIGHT = {
  land: "#F5F4F1",
  water: "#C9D7E2",
  park: "#DDE6D6",
  wood: "#D7E1D0",
  sand: "#EEEDEA",
  building: "#E9E9E7",
  road: "#FFFFFF",
  roadFar: "#DDDDDB",
  roadMid: "#E9E9E7",
  tunnel: "#F7F7F6",
  rail: "#E0E0DE",
  path: "#E6E6E4",
  label: "#8F8F8D",
  labelStrong: "#6E6E6C",
  hood: "#A3A3A1",
  waterLabel: "#8397A8",
  halo: "rgba(245,244,241,0.92)",
};

type Palette = typeof LIGHT;

const DARK: Palette = {
  land: "#1A1A1C",
  water: "#1C2831",
  park: "#1D271F",
  wood: "#1B251D",
  sand: "#222221",
  building: "#252527",
  road: "#323235",
  roadFar: "#232326",
  roadMid: "#2A2A2D",
  tunnel: "#202023",
  rail: "#2B2B2E",
  path: "#2A2A2D",
  label: "#86868B",
  labelStrong: "#A6A6AB",
  hood: "#737378",
  waterLabel: "#6C8394",
  halo: "rgba(26,26,28,0.92)",
};

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
  "text-halo-color": C.halo,
  "text-halo-width": 1.2,
});

export function buildMapStyle(
  tiles: TileSource,
  origin: string,
  scheme: ColorScheme = "light",
): StyleSpecification {
  const C = scheme === "dark" ? DARK : LIGHT;
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
    name: scheme === "dark" ? "SF Recs Paper (dark)" : "SF Recs Paper",
    glyphs,
    // Labels are drawn from the same Inter Variable file as the UI.
    "font-faces": { Inter: `${origin}/fonts/InterVariable.woff2` },
    sources: { basemap: source(tiles, origin) },
    layers,
  };
}
