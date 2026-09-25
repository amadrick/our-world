import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from "maplibre-gl";

import {
  FONT,
  byZoom,
  classIn,
  halo,
  hexId,
  isLine,
  isPolygon,
  named,
  notTunnel,
  pinFootprintLayer,
  ramp,
  type MapTheme,
  type Stops,
} from "./kit";

/**
 * (d) Apple Maps match: the flat Standard map in Apple Maps, with none of the
 * detail it leaves out. Water is one bright sky blue, land a pale neutral
 * grey, parks a fresh green, a few commercial blocks pale beige; no hillshade,
 * no 3D, no tilt. Neighborhoods in bold spaced capitals, street names in small
 * grey capitals once you're zoomed in, water in blue italic. Inter stands in
 * for SF Pro, which can't be bundled.
 */
const LIGHT = {
  land: "#F3F2EE",
  beige: "#F6ECD8",
  sand: "#F4ECD4",
  park: "#C4E79A",
  wood: "#BBE292",
  water: "#8FCFF3",
  ferry: "#6CBCEB",
  pier: "#ECECEB",
  building: "#EAE9E5",
  street: "#FFFFFF",
  streetFar: "#E4E3DF",
  streetCase: "#DDDCD8",
  arterial: "#F0F0EE",
  arterialCase: "#D4D3CF",
  freeway: "#FBE2A2",
  freewayCase: "#EAC97C",
  rail: "#DCDBD7",
  streetLabel: "#737780",
  hood: "#4B5566",
  city: "#3A3A3C",
  waterLabel: "#4A88BD",
  parkLabel: "#3E8E46",
  landmark: "#8B95A3",
  landmarkLabel: "#6E7179",
};

type ApplePalette = typeof LIGHT;

const DARK: ApplePalette = {
  land: "#262A31",
  beige: "#2F2E2C",
  sand: "#322F29",
  park: "#27402C",
  wood: "#243C29",
  water: "#15263C",
  ferry: "#2D4E72",
  pier: "#31353C",
  building: "#2C3037",
  street: "#3D424A",
  streetFar: "#33373E",
  streetCase: "#2E3239",
  arterial: "#4A4F58",
  arterialCase: "#363A42",
  freeway: "#6A5B3C",
  freewayCase: "#4F4530",
  rail: "#383C43",
  streetLabel: "#9DA3AD",
  hood: "#AEB6C3",
  city: "#E5E5EA",
  waterLabel: "#6E9CCF",
  parkLabel: "#7DB986",
  landmark: "#8A919C",
  landmarkLabel: "#A9AEB6",
};

interface Road {
  id: string;
  classes: string[];
  minzoom: number;
  width: Stops;
  fill: keyof ApplePalette;
  casing: keyof ApplePalette;
}

/** Apple draws streets wide and even; arterials a little wider and greyer, freeways pale amber. */
const ROADS: Road[] = [
  { id: "service", classes: ["service"], minzoom: 14.5, width: [[14.5, 0.8], [15, 1.4], [17, 4.5], [19, 11]], fill: "street", casing: "streetCase" },
  { id: "street", classes: ["minor", "tertiary"], minzoom: 12, width: [[12, 0.4], [13, 1], [14, 3], [15, 5], [17, 11], [19, 26]], fill: "street", casing: "streetCase" },
  { id: "arterial", classes: ["secondary", "primary", "trunk"], minzoom: 9, width: [[9, 0.5], [11, 1], [12, 1.8], [14, 4.4], [15, 7], [17, 15], [19, 34]], fill: "arterial", casing: "arterialCase" },
  { id: "freeway", classes: ["motorway"], minzoom: 7, width: [[7, 0.8], [10, 1.6], [12, 2.6], [14, 5.2], [15, 8], [17, 18], [19, 40]], fill: "freeway", casing: "freewayCase" },
];
const roadFilter = (classes: string[]): FilterSpecification =>
  ["all", isLine, notTunnel, classIn(classes)] as FilterSpecification;

/** Apple's street-label shorthand: "North Point Street" reads N POINT ST. */
const SUFFIXES: [string, string][] = [
  [" Street", " St"],
  [" Avenue", " Ave"],
  [" Boulevard", " Blvd"],
  [" Drive", " Dr"],
  [" Terrace", " Ter"],
  [" Place", " Pl"],
  [" Court", " Ct"],
  [" Lane", " Ln"],
];
const PREFIXES: [string, string][] = [
  ["North ", "N "],
  ["South ", "S "],
  ["East ", "E "],
  ["West ", "W "],
];
function streetName(): ExpressionSpecification {
  const n: ExpressionSpecification = ["var", "n"];
  let name: ExpressionSpecification = ["to-string", ["get", "name"]];
  for (const [long, short] of SUFFIXES) {
    const at: ExpressionSpecification = ["index-of", long, n];
    name = [
      "let",
      "n",
      name,
      ["case", [">=", at, 0], ["concat", ["slice", n, 0, at], short, ["slice", n, ["+", at, long.length]]], n],
    ];
  }
  for (const [long, short] of PREFIXES) {
    name = ["let", "n", name, ["case", ["==", ["index-of", long, n], 0], ["concat", short, ["slice", n, long.length]], n]];
  }
  return name;
}

export const apple: MapTheme<ApplePalette> = {
  id: "apple",
  label: "Apple Maps match",
  palettes: { light: LIGHT, dark: DARK },
  tint: {
    land: [0.5, 0.02],
    beige: [0.4, 0.024],
    sand: [0.4, 0.024],
    pier: [0.45, 0.02],
    building: [0.45, 0.022],
    streetFar: [0.45, 0.018],
    streetCase: [0.45, 0.018],
    arterialCase: [0.45, 0.018],
    park: [0.2, 0.05],
    wood: [0.2, 0.05],
    water: [0.18, 0.05],
  },
  pitch: 0,
  layers(C) {
    return [
      { id: "background", type: "background", paint: { "background-color": C.land } },
      {
        id: "beige-blocks",
        type: "fill",
        source: "basemap",
        "source-layer": "landuse",
        minzoom: 12,
        filter: classIn(["commercial", "retail", "school", "college", "university", "hospital"]),
        paint: { "fill-color": C.beige, "fill-opacity": byZoom(12, 0, 13, 1) },
      },
      {
        id: "sand",
        type: "fill",
        source: "basemap",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "sand"],
        paint: { "fill-color": C.sand },
      },
      { id: "park", type: "fill", source: "basemap", "source-layer": "park", paint: { "fill-color": C.park } },
      {
        id: "greenery",
        type: "fill",
        source: "basemap",
        "source-layer": "landcover",
        filter: classIn(["grass", "wood", "wetland"]),
        paint: { "fill-color": ["match", ["get", "class"], "wood", C.wood, C.park] },
      },
      {
        id: "pitch",
        type: "fill",
        source: "basemap",
        "source-layer": "landuse",
        minzoom: 13,
        filter: classIn(["pitch", "playground", "stadium", "cemetery"]),
        paint: { "fill-color": C.park },
      },
      {
        id: "water",
        type: "fill",
        source: "basemap",
        "source-layer": "water",
        filter: notTunnel,
        paint: { "fill-color": C.water, "fill-antialias": false },
      },
      {
        id: "waterway",
        type: "line",
        source: "basemap",
        "source-layer": "waterway",
        minzoom: 12,
        paint: { "line-color": C.water, "line-width": ramp([[12, 0.6], [16, 1.8], [18, 3.5]]) },
      },
      {
        id: "ferry",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["all", isLine, ["==", ["get", "class"], "ferry"]],
        paint: { "line-color": C.ferry, "line-width": byZoom(11, 0.6, 16, 1.2), "line-opacity": 0.7 },
      },
      {
        id: "pier",
        type: "fill",
        source: "basemap",
        "source-layer": "transportation",
        filter: ["all", isPolygon, ["==", ["get", "class"], "pier"]],
        paint: { "fill-color": C.pier },
      },
      {
        id: "building",
        type: "fill",
        source: "basemap",
        "source-layer": "building",
        minzoom: 15,
        paint: { "fill-color": C.building, "fill-opacity": byZoom(15, 0, 15.8, 1) },
      },
      {
        id: "rail",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: 14,
        filter: ["all", isLine, classIn(["rail"]), notTunnel],
        paint: { "line-color": C.rail, "line-width": byZoom(14, 0.8, 18, 1.6) },
      },
      ...ROADS.filter((r) => r.id !== "service").map<LayerSpecification>((r) => ({
        id: `road-case-${r.id}`,
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: 12.5,
        filter: roadFilter(r.classes),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": C[r.casing],
          "line-width": ramp(r.width.map(([z, w]) => [z, w + 1.4])),
          "line-opacity": byZoom(12.5, 0, 13.5, 1),
        },
      })),
      ...ROADS.map<LayerSpecification>((r) => ({
        id: `road-${r.id}`,
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: r.minzoom,
        filter: roadFilter(r.classes),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          // Far out, white streets would vanish into the pale land; they start grey and whiten closer in.
          "line-color": r.fill === "street" ? byZoom(11, C.streetFar, 13.5, C.street) : C[r.fill],
          "line-width": ramp(r.width),
        },
      })),
      {
        id: "water-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "water_name",
        filter: ["==", ["geometry-type"], "Point"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT.mediumItalic,
          "text-size": byZoom(8, 11.5, 14, 14),
          "text-letter-spacing": 0.02,
          "text-max-width": 7,
        },
        paint: { "text-color": C.waterLabel },
      },
      {
        id: "ferry-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "transportation_name",
        minzoom: 13.5,
        filter: ["==", ["get", "class"], "ferry"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT.mediumItalic,
          "text-size": 10.5,
          "symbol-placement": "line",
          "symbol-spacing": 600,
          "text-padding": 20,
        },
        paint: { "text-color": C.waterLabel, "text-opacity": 0.85 },
      },
      {
        id: "street-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "transportation_name",
        minzoom: 14,
        filter: ["all", classIn(["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]), named],
        layout: {
          "text-field": streetName(),
          "text-font": FONT.medium,
          "text-transform": "uppercase",
          "text-size": byZoom(14, 9.5, 18, 11.5),
          "text-letter-spacing": 0.08,
          "symbol-placement": "line",
          "text-padding": 14,
        },
        paint: { "text-color": C.streetLabel, "text-halo-color": halo(C.street, "e6"), "text-halo-width": 1.4 },
      },
      {
        id: "park-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "poi",
        minzoom: 14,
        filter: ["all", classIn(["park", "national_park"]), named],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT.semibold,
          "text-size": byZoom(14, 11, 17, 12.5),
          "text-max-width": 8,
          "text-padding": 14,
        },
        paint: { "text-color": C.parkLabel, "text-halo-color": halo(C.land, "cc"), "text-halo-width": 1.2 },
      },
      {
        id: "neighborhood-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "place",
        minzoom: 11.5,
        maxzoom: 16.5,
        filter: classIn(["neighbourhood", "suburb", "quarter"]),
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT.bold,
          "text-transform": "uppercase",
          "text-size": byZoom(11.5, 9.5, 15, 13.5),
          "text-letter-spacing": 0.1,
          "text-max-width": 8,
          "text-padding": 6,
          "text-variable-anchor": ["center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"],
          "text-radial-offset": 1.3,
          "text-justify": "auto",
          "symbol-sort-key": ["match", ["get", "class"], ["suburb", "quarter"], 0, 1],
        },
        paint: {
          "text-color": C.hood,
          "text-halo-color": halo(C.land, "d9"),
          "text-halo-width": 1.4,
          "text-opacity": byZoom(11.5, 0.7, 13, 1, 16, 1, 16.5, 0),
        },
      },
      // Landmarks carry Apple's small grey caption under a round marker; our photo pins are the heroes.
      {
        id: "landmark-label",
        type: "symbol",
        source: "landmarks",
        minzoom: 12.5,
        filter: ["all", ["==", ["get", "kind"], "landmark"], ["any", ["==", ["get", "rank"], 1], [">=", ["zoom"], 14.5]]],
        layout: {
          "icon-image": `dot-${hexId(C.landmark)}`,
          "icon-size": 0.75,
          "text-field": ["get", "name"],
          "text-font": FONT.semibold,
          "text-transform": "uppercase",
          "text-size": byZoom(12.5, 9.5, 16, 10.5),
          "text-letter-spacing": 0.06,
          "text-anchor": "top",
          "text-offset": [0, 0.9],
          "text-max-width": 9,
          "text-padding": 6,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: { "text-color": C.landmarkLabel, "text-halo-color": halo(C.land, "e6"), "text-halo-width": 1.4 },
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
          "text-font": FONT.semibold,
          "text-size": byZoom(6, 11.5, 11, 16),
          "text-max-width": 8,
        },
        paint: { "text-color": C.city, "text-halo-color": halo(C.land), "text-halo-width": 1.5 },
      },
      pinFootprintLayer(),
    ];
  },
};
