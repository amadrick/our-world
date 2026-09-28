import type { FilterSpecification, LayerSpecification } from "maplibre-gl";

import { filmLabels } from "./film";
import {
  byZoom,
  classIn,
  isLine,
  isPolygon,
  notTunnel,
  pinFootprintLayer,
  ramp,
  type MapTheme,
  type Stops,
} from "./kit";

/**
 * (f) Ink: a flat, near-white paper map drawn in one ink. Land is a white
 * with the faintest warmth, every road from footpath to freeway is the same
 * #111111 and only its width says what it is, parks are a clean green and
 * water a clean blue. Buildings barely show. No hillshade, no 3D, no tilt.
 */
const LIGHT = {
  land: "#FCFBF9",
  sand: "#F7F3E8",
  park: "#BEE3B3",
  wood: "#B3DEA8",
  water: "#A3D3F3",
  ferry: "#6FB3E3",
  pier: "#F3F1ED",
  building: "#F3F1EC",
  road: "#111111",
  rail: "#C9C6C0",
  streetLabel: "#3C3C3C",
  hood: "#2A2A2A",
  labelHalo: "#FFFFFF",
  waterLabel: "#2F6FA8",
  parkLabel: "#2C7A38",
};

type InkPalette = typeof LIGHT;

/** The same map in white ink on near-black paper: chalk roads, deep green parks, a night-blue bay. */
const DARK: InkPalette = {
  land: "#161615",
  sand: "#22211D",
  park: "#1D3A25",
  wood: "#1B3622",
  water: "#132F4B",
  ferry: "#3F79AD",
  pier: "#232220",
  building: "#1F1E1C",
  road: "#ECEAE5",
  rail: "#45433F",
  streetLabel: "#CFCDC8",
  hood: "#E4E2DD",
  labelHalo: "#161615",
  waterLabel: "#86B9E4",
  parkLabel: "#86CC92",
};

interface Road {
  id: string;
  classes: string[];
  minzoom: number;
  width: Stops;
}

/** One ink, so width is the whole hierarchy: hairline paths up to a firm freeway stroke, all thin enough to stay light. */
const ROADS: Road[] = [
  { id: "path", classes: ["path", "track"], minzoom: 15, width: [[15, 0.35], [17, 0.7], [19, 1.4]] },
  { id: "service", classes: ["service"], minzoom: 14.5, width: [[14.5, 0.3], [16, 0.6], [18, 1.3], [19, 2]] },
  { id: "minor", classes: ["minor"], minzoom: 13, width: [[13, 0.25], [14, 0.45], [15, 0.8], [17, 1.6], [19, 3.2]] },
  { id: "tertiary", classes: ["tertiary"], minzoom: 11, width: [[11, 0.25], [13, 0.45], [14, 0.75], [15, 1.1], [17, 2.2], [19, 4.4]] },
  { id: "secondary", classes: ["secondary"], minzoom: 10, width: [[10, 0.3], [12, 0.55], [14, 1], [15, 1.4], [17, 2.8], [19, 5.6]] },
  { id: "primary", classes: ["primary", "trunk"], minzoom: 8, width: [[8, 0.3], [11, 0.65], [13, 1], [14, 1.35], [15, 1.8], [17, 3.6], [19, 7.2]] },
  { id: "freeway", classes: ["motorway"], minzoom: 6, width: [[6, 0.4], [10, 0.9], [12, 1.3], [14, 2], [15, 2.6], [17, 5.2], [19, 10.4]] },
];
const roadFilter = (classes: string[]): FilterSpecification =>
  ["all", isLine, notTunnel, classIn(classes)] as FilterSpecification;

export const ink: MapTheme<InkPalette> = {
  id: "ink",
  label: "Ink",
  palettes: { light: LIGHT, dark: DARK },
  tint: {
    // Just enough to feel the place; the paper has to stay white.
    land: [0.25, 0.006],
    sand: [0.25, 0.01],
    pier: [0.25, 0.006],
    building: [0.25, 0.008],
    park: [0.15, 0.04],
    wood: [0.15, 0.04],
    water: [0.15, 0.04],
  },
  pitch: 0,
  layers(C) {
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
        paint: { "line-color": C.ferry, "line-width": byZoom(11, 0.6, 16, 1.1), "line-dasharray": [3, 3] },
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
        paint: { "fill-color": C.building, "fill-opacity": byZoom(15, 0, 16, 1) },
      },
      {
        id: "rail",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: 13,
        filter: ["all", isLine, classIn(["rail", "transit"]), notTunnel],
        paint: { "line-color": C.rail, "line-width": byZoom(13, 0.5, 18, 1.2) },
      },
      ...ROADS.map<LayerSpecification>((r) => ({
        id: `road-${r.id}`,
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: r.minzoom,
        filter: roadFilter(r.classes),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": C.road, "line-width": ramp(r.width) },
      })),
      ...filmLabels(C, "crisp"),
      pinFootprintLayer(),
    ];
  },
};
