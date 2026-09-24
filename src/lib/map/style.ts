import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

/**
 * A muted, Apple Maps–inspired basemap for OpenMapTiles-schema vector tiles
 * (what OpenFreeMap serves for free, no key needed). Pins are the only
 * saturated color on screen, so everything here stays soft and warm.
 */

export type TileSource = "openfreemap" | "offline";

const C = {
  land: "#F4F2EE",
  water: "#AAD3F0",
  park: "#D4EACB",
  wood: "#C7E2BC",
  sand: "#F3EBD4",
  hospital: "#F6E6E5",
  school: "#F1ECE1",
  cemetery: "#DDE8D4",
  pitch: "#D9EBD0",
  industrial: "#EEEBE6",
  aeroway: "#EAE7E1",
  building: "#E9E6E0",
  buildingOutline: "#DEDAD2",
  road: "#FFFFFF",
  roadCasing: "#E3DFD7",
  majorCasing: "#DCD7CD",
  motorway: "#F8E0A6",
  motorwayCasing: "#E8C680",
  tunnel: "#F9F8F6",
  path: "#D9D4C9",
  rail: "#D5D1C9",
  ferry: "#8DBBE0",
  label: "#75716A",
  labelStrong: "#4B4741",
  hood: "#9A958D",
  waterLabel: "#5C8DB9",
  parkLabel: "#5B8A53",
  halo: "rgba(255,255,255,0.92)",
};

const FONT = {
  regular: ["Noto Sans Regular"],
  bold: ["Noto Sans Bold"],
  italic: ["Noto Sans Italic"],
};

type Stops = [zoom: number, width: number][];
type Expr = ExpressionSpecification;

function widths(stops: Stops): Expr {
  return ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flat()] as Expr;
}

function casing(stops: Stops): Expr {
  return widths(stops.map(([z, w]) => [z, w + (z < 13 ? 0.8 : z < 16 ? 1.6 : 2.6)]));
}

const W = {
  motorway: [[7, 0.6], [10, 1.6], [13, 3], [15, 7], [17, 16], [19, 34]] as Stops,
  major: [[9, 0.4], [11, 1], [13, 2.2], [15, 6], [17, 13], [19, 28]] as Stops,
  medium: [[10, 0.3], [12, 0.8], [13, 1.6], [15, 4.5], [17, 10], [19, 22]] as Stops,
  minor: [[12, 0.3], [13, 0.8], [15, 3], [17, 8], [19, 18]] as Stops,
  service: [[14, 0.5], [15, 1.5], [17, 4.5], [19, 10]] as Stops,
};

const ROAD_GROUPS = {
  motorway: ["motorway"],
  major: ["trunk", "primary"],
  medium: ["secondary", "tertiary"],
  minor: ["minor"],
  service: ["service"],
} as const;

type RoadGroup = keyof typeof ROAD_GROUPS;

const classIn = (classes: readonly string[]): Expr =>
  ["match", ["get", "class"], [...classes], true, false] as Expr;

const isLine: Expr = ["==", ["geometry-type"], "LineString"];

const brunnelIs = (value: "bridge" | "tunnel" | null): Expr =>
  value === null
    ? (["match", ["coalesce", ["get", "brunnel"], ""], ["bridge", "tunnel"], false, true] as Expr)
    : (["==", ["get", "brunnel"], value] as Expr);

function roadLayers(
  brunnel: "bridge" | "tunnel" | null,
  prefix: string,
): LayerSpecification[] {
  const groups: RoadGroup[] = ["service", "minor", "medium", "major", "motorway"];
  const minzoom: Record<RoadGroup, number> = {
    service: 14,
    minor: 12,
    medium: 10,
    major: 8,
    motorway: 6,
  };
  const casingColor = (g: RoadGroup) =>
    brunnel === "tunnel"
      ? C.roadCasing
      : g === "motorway"
        ? C.motorwayCasing
        : g === "major" || g === "medium"
          ? C.majorCasing
          : C.roadCasing;
  const fillColor = (g: RoadGroup) =>
    brunnel === "tunnel" ? C.tunnel : g === "motorway" ? C.motorway : C.road;

  const casings: LayerSpecification[] = groups.map((g) => ({
    id: `${prefix}-${g}-casing`,
    type: "line",
    source: "basemap",
    "source-layer": "transportation",
    minzoom: Math.max(minzoom[g], g === "minor" ? 13 : minzoom[g]),
    filter: ["all", isLine, brunnelIs(brunnel), classIn(ROAD_GROUPS[g])],
    layout: { "line-cap": brunnel === "tunnel" ? "butt" : "round", "line-join": "round" },
    paint: {
      "line-color": casingColor(g),
      "line-width": casing(W[g]),
      ...(brunnel === "tunnel" ? { "line-dasharray": [0.6, 0.4] } : {}),
    },
  }));

  const fills: LayerSpecification[] = groups.map((g) => ({
    id: `${prefix}-${g}`,
    type: "line",
    source: "basemap",
    "source-layer": "transportation",
    minzoom: minzoom[g],
    filter: ["all", isLine, brunnelIs(brunnel), classIn(ROAD_GROUPS[g])],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": fillColor(g), "line-width": widths(W[g]) },
  }));

  // Bridges draw each class's casing right under its own fill so overpasses read clearly.
  if (brunnel === "bridge") return groups.flatMap((_, i) => [casings[i], fills[i]]);
  return [...casings, ...fills];
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

export function buildMapStyle(tiles: TileSource, origin: string): StyleSpecification {
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
      id: "landuse",
      type: "fill",
      source: "basemap",
      "source-layer": "landuse",
      minzoom: 11,
      filter: classIn([
        "hospital", "school", "university", "college", "kindergarten", "cemetery",
        "stadium", "pitch", "playground", "industrial", "railway",
      ]),
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "hospital", C.hospital,
          ["school", "university", "college", "kindergarten"], C.school,
          "cemetery", C.cemetery,
          ["stadium", "pitch", "playground"], C.pitch,
          C.industrial,
        ],
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 13, 1],
      },
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
      paint: {
        "fill-color": ["match", ["get", "class"], "wood", C.wood, C.park],
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 10, 1],
      },
    },
    {
      id: "water",
      type: "fill",
      source: "basemap",
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": C.water },
    },
    {
      id: "waterway",
      type: "line",
      source: "basemap",
      "source-layer": "waterway",
      minzoom: 11,
      paint: {
        "line-color": C.water,
        "line-width": widths([[11, 0.5], [15, 1.5], [18, 4]]),
      },
    },
    {
      id: "aeroway",
      type: "fill",
      source: "basemap",
      "source-layer": "aeroway",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": C.aeroway },
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
      minzoom: 14,
      paint: {
        "fill-color": C.building,
        "fill-outline-color": C.buildingOutline,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
      },
    },
    ...roadLayers("tunnel", "tunnel"),
    {
      id: "path",
      type: "line",
      source: "basemap",
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["all", isLine, ["==", ["get", "class"], "path"], brunnelIs(null)],
      paint: {
        "line-color": C.path,
        "line-width": widths([[14, 0.6], [17, 1.6], [19, 3]]),
        "line-dasharray": [2, 1.5],
      },
    },
    {
      id: "rail",
      type: "line",
      source: "basemap",
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["all", isLine, classIn(["rail", "transit"]), ["!=", ["get", "brunnel"], "tunnel"]],
      paint: { "line-color": C.rail, "line-width": widths([[12, 0.6], [16, 1.4], [19, 2.5]]) },
    },
    {
      id: "ferry",
      type: "line",
      source: "basemap",
      "source-layer": "transportation",
      minzoom: 10,
      filter: ["==", ["get", "class"], "ferry"],
      paint: { "line-color": C.ferry, "line-width": 1, "line-dasharray": [3, 3], "line-opacity": 0.7 },
    },
    ...roadLayers(null, "road"),
    ...roadLayers("bridge", "bridge"),
    {
      id: "water-label",
      type: "symbol",
      source: "basemap",
      "source-layer": "water_name",
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT.italic,
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 14, 15],
        "text-letter-spacing": 0.06,
        "text-max-width": 6,
      },
      paint: { "text-color": C.waterLabel, "text-halo-color": C.halo, "text-halo-width": 1 },
    },
    {
      id: "road-label",
      type: "symbol",
      source: "basemap",
      "source-layer": "transportation_name",
      minzoom: 13,
      filter: [
        "any",
        classIn(["motorway", "trunk", "primary", "secondary", "tertiary"]),
        ["all", classIn(["minor"]), [">=", ["zoom"], 15]],
      ],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 17, 13],
        "symbol-placement": "line",
        "text-letter-spacing": 0.02,
        "text-padding": 8,
      },
      paint: { "text-color": C.label, "text-halo-color": C.halo, "text-halo-width": 1.5 },
    },
    {
      id: "park-label",
      type: "symbol",
      source: "basemap",
      "source-layer": "poi",
      minzoom: 14,
      filter: ["all", ["==", ["get", "class"], "park"], ["has", "name"]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10.5, 17, 12.5],
        "text-max-width": 8,
        "text-padding": 6,
      },
      paint: { "text-color": C.parkLabel, "text-halo-color": C.halo, "text-halo-width": 1.2 },
    },
    {
      id: "neighborhood-label",
      type: "symbol",
      source: "basemap",
      "source-layer": "place",
      minzoom: 11.5,
      maxzoom: 16,
      filter: classIn(["neighbourhood", "suburb", "quarter"]),
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT.bold,
        "text-transform": "uppercase",
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 9.5, 15, 12],
        "text-letter-spacing": 0.14,
        "text-max-width": 7,
        "text-padding": 6,
      },
      paint: { "text-color": C.hood, "text-halo-color": C.halo, "text-halo-width": 1.2 },
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
        "text-font": FONT.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 11, 16],
        "text-max-width": 8,
      },
      paint: { "text-color": C.labelStrong, "text-halo-color": C.halo, "text-halo-width": 1.5 },
    },
  ];

  return {
    version: 8,
    name: "SF Recs Soft",
    glyphs,
    sources: { basemap: source(tiles, origin) },
    layers,
  };
}
