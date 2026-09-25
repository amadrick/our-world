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
 * (e) Film: a clean, precise map that looks gently photographed on Kodak 35mm
 * (Andy's reference, briefs/film-map-ref-andy.png). Warm pale stone land with
 * fine streets a shade lighter than it, mineral grey-blue water, muted sage
 * parks with a faint speckle, and only a few labels: districts and water in
 * widely spaced small grey capitals, street names only up close. The grain,
 * haze, and soft edges live in an overlay above the canvas (`.map-film`).
 */
const LIGHT = {
  land: "#E2D9CD",
  sand: "#E5DBCC",
  park: "#A2A998",
  wood: "#9CA392",
  pitch: "#AAB0A0",
  speckle: "#6C7265",
  water: "#AEB9B9",
  pier: "#DAD1C4",
  building: "#DAD1C5",
  street: "#F2EDE5",
  streetFar: "#EFE9E0",
  major: "#F5F1EA",
  majorCase: "#D3CABE",
  freeway: "#F3EEE6",
  freewayCase: "#CDC4B8",
  rail: "#CFC6BA",
  hood: "#7C7A74",
  parkLabel: "#E2DED4",
  waterLabel: "#8A979B",
  streetLabel: "#948E85",
  labelHalo: "#E2D9CD",
};

type FilmPalette = typeof LIGHT;

/** Not in the reference (it's light only): the same film, printed dark. */
const DARK: FilmPalette = {
  land: "#33302C",
  sand: "#37332D",
  park: "#3B4136",
  wood: "#373D33",
  pitch: "#414838",
  speckle: "#262A23",
  water: "#262D31",
  pier: "#2F2C28",
  building: "#393531",
  street: "#48443E",
  streetFar: "#423E39",
  major: "#48443E",
  majorCase: "#2B2925",
  freeway: "#4D4842",
  freewayCase: "#2A2824",
  rail: "#45413B",
  hood: "#9C958B",
  parkLabel: "#7E8575",
  waterLabel: "#6F7B82",
  streetLabel: "#8A847A",
  labelHalo: "#33302C",
};

interface Road {
  id: string;
  classes: string[];
  minzoom: number;
  width: Stops;
  fill: keyof FilmPalette;
  casing?: keyof FilmPalette;
}

/** Hairline streets that thicken slowly; the bigger roads are only a little stronger. */
const ROADS: Road[] = [
  { id: "service", classes: ["service"], minzoom: 15, width: [[15, 0.6], [17, 2.4], [19, 7]], fill: "street" },
  { id: "street", classes: ["minor", "tertiary"], minzoom: 11, width: [[11, 0.35], [12, 0.7], [13, 1.2], [14, 1.7], [15, 2.4], [17, 6], [19, 16]], fill: "street" },
  { id: "major", classes: ["secondary", "primary", "trunk"], minzoom: 9, width: [[9, 0.4], [12, 1.2], [13, 1.8], [14, 2.4], [15, 3.4], [17, 8], [19, 20]], fill: "major", casing: "majorCase" },
  { id: "freeway", classes: ["motorway"], minzoom: 7, width: [[7, 0.5], [11, 1.2], [13, 2], [15, 4], [17, 10], [19, 24]], fill: "freeway", casing: "freewayCase" },
];
const roadFilter = (classes: string[]): FilterSpecification =>
  ["all", isLine, notTunnel, classIn(classes)] as FilterSpecification;

/** The districts the reference names at city zoom, in its short forms. Other neighborhoods wait until you zoom in. */
const DISTRICTS: Record<string, string> = {
  "Marina District": "Marina",
  "Pacific Heights": "Pacific Heights",
  "North Beach": "North Beach",
  "Richmond District": "Richmond",
  "Haight-Ashbury": "Haight",
  "Mission District": "Mission",
  "Potrero Hill": "Potrero Hill",
  "Sunset District": "Sunset",
  "Bernal Heights": "Bernal Heights",
};

const shortName = (renames: Record<string, string>): ExpressionSpecification => [
  "match",
  ["to-string", ["get", "name"]],
  ...Object.entries(renames).flat(),
  ["to-string", ["get", "name"]],
] as ExpressionSpecification;

const spacedCaps = {
  "text-font": FONT.medium,
  "text-transform": "uppercase",
  "text-letter-spacing": 0.24,
  "text-max-width": 9,
} as const;

export const film: MapTheme<FilmPalette> = {
  id: "film",
  label: "Film",
  palettes: { light: LIGHT, dark: DARK },
  tint: {
    land: [0.5, 0.018],
    sand: [0.4, 0.02],
    pier: [0.45, 0.018],
    building: [0.45, 0.018],
    streetFar: [0.45, 0.014],
    majorCase: [0.45, 0.014],
    park: [0.2, 0.04],
    wood: [0.2, 0.04],
    pitch: [0.2, 0.04],
    water: [0.18, 0.04],
    labelHalo: [0.5, 0.018],
  },
  pitch: 0,
  overlay: "film",
  layers(C, { scheme }) {
    const dark = scheme === "dark";
    return [
      { id: "background", type: "background", paint: { "background-color": C.land } },
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
        paint: { "fill-color": C.pitch },
      },
      // The faint texture the reference's parks have, like foliage seen from far above.
      {
        id: "park-mottle",
        type: "fill",
        source: "basemap",
        "source-layer": "park",
        minzoom: 10,
        paint: { "fill-pattern": `mottle-${hexId(C.speckle)}-${dark ? 50 : 45}`, "fill-opacity": byZoom(10, 0, 11.5, 1) },
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
        paint: { "line-color": C.water, "line-width": ramp([[12, 0.5], [16, 1.6], [18, 3]]) },
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
        paint: { "fill-color": C.building, "fill-opacity": byZoom(15, 0, 16, 0.8) },
      },
      {
        id: "rail",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: 13,
        filter: ["all", isLine, classIn(["rail"]), notTunnel],
        paint: { "line-color": C.rail, "line-width": byZoom(13, 0.5, 18, 1.2) },
      },
      ...ROADS.filter((r) => r.casing).map<LayerSpecification>((r) => ({
        id: `road-case-${r.id}`,
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: 12,
        filter: roadFilter(r.classes),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": C[r.casing!],
          "line-width": ramp(r.width.map(([z, w]) => [z, w + 1])),
          "line-opacity": byZoom(12, 0, 13, 0.7),
          "line-blur": 0.4,
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
          "line-color": r.fill === "street" ? byZoom(12.5, C.streetFar, 14, C.street) : C[r.fill],
          "line-width": ramp(r.width),
          "line-blur": 0.3,
        },
      })),
      {
        id: "water-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "water_name",
        filter: ["all", ["==", ["geometry-type"], "Point"], classIn(["ocean", "sea", "bay"])],
        layout: { ...spacedCaps, "text-field": shortName({ "San Francisco Bay": "SF Bay" }), "text-size": byZoom(10, 10.5, 13, 12, 15, 13) },
        paint: { "text-color": C.waterLabel, "text-halo-color": halo(C.water, "99"), "text-halo-width": 1 },
      },
      {
        id: "street-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "transportation_name",
        minzoom: 15,
        filter: ["all", classIn(["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]), named],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT.medium,
          "text-transform": "uppercase",
          "text-size": byZoom(15, 9, 18, 10.5),
          "text-letter-spacing": 0.14,
          "symbol-placement": "line",
          "text-padding": 20,
        },
        paint: {
          "text-color": C.streetLabel,
          "text-halo-color": halo(C.labelHalo, "cc"),
          "text-halo-width": 1.2,
          "text-opacity": byZoom(15, 0, 15.6, 0.85),
        },
      },
      // The Presidio is named like a district, as in the reference; other parks go unlabeled.
      {
        id: "park-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "poi",
        minzoom: 11.5,
        maxzoom: 15,
        filter: ["==", ["get", "name"], "Presidio of San Francisco"],
        layout: { ...spacedCaps, "text-field": "Presidio", "text-size": byZoom(11, 10.5, 13, 12, 15, 13) },
        paint: { "text-color": C.parkLabel },
      },
      {
        id: "neighborhood-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "place",
        minzoom: 11.5,
        maxzoom: 16.5,
        filter: [
          "all",
          classIn(["neighbourhood", "suburb", "quarter"]),
          ["any", [">=", ["zoom"], 14], ["in", ["get", "name"], ["literal", Object.keys(DISTRICTS)]]],
        ],
        layout: {
          ...spacedCaps,
          "text-field": shortName(DISTRICTS),
          "text-size": byZoom(11, 10.5, 13, 12, 15, 13),
          "text-padding": 8,
          "text-variable-anchor": ["center", "top", "bottom", "left", "right"],
          "text-radial-offset": 1,
          "text-justify": "auto",
        },
        paint: {
          "text-color": C.hood,
          "text-halo-color": halo(C.labelHalo, "80"),
          "text-halo-width": 1,
          "text-opacity": byZoom(11.5, 0.8, 12.5, 1, 16, 1, 16.5, 0),
        },
      },
      pinFootprintLayer(),
    ];
  },
};
