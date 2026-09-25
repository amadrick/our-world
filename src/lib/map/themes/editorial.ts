import type { LayerSpecification } from "maplibre-gl";

import {
  FONT,
  ROAD_MIN_ZOOM,
  ROAD_ORDER,
  byZoom,
  classIn,
  halo,
  isLine,
  isPolygon,
  named,
  notTunnel,
  pinFootprintLayer,
  ramp,
  roadFilter,
  type MapTheme,
  type RoadGroup,
  type Stops,
} from "./kit";

/**
 * (b) Editorial cartography: a printed city map. Paper land against clear
 * blue water, a hairline coastline with engraved water lines echoing it
 * offshore, fine hairline streets, and type doing the work: neighborhood
 * names in a serif as the hero labels, districts in spaced capitals, water
 * and parks in italic. No points of interest.
 */
const LIGHT = {
  land: "#F7F3EB",
  park: "#DEE4CB",
  parkEdge: "#B4C09A",
  wood: "#D3DCBB",
  sand: "#EFE6D1",
  water: "#A3C0D2",
  coast: "#5F819A",
  waterLine: "#6F91A9",
  building: "#EFE9DE",
  buildingEdge: "#DDD4C4",
  street: "#C3BAAA",
  medium: "#AFA595",
  major: "#9A8F7F",
  motorway: "#877C6C",
  rail: "#B3AA9C",
  label: "#877F72",
  hood: "#37322B",
  quarter: "#2E2A24",
  district: "#8A7F6E",
  waterLabel: "#4B6D86",
  parkLabel: "#5A6848",
  city: "#2E2A24",
};

type EditorialPalette = typeof LIGHT;

const DARK: EditorialPalette = {
  land: "#18191B",
  park: "#1D241B",
  parkEdge: "#34432C",
  wood: "#1A2218",
  sand: "#222119",
  water: "#0C1C27",
  coast: "#46677F",
  waterLine: "#2F4C61",
  building: "#1F2023",
  buildingEdge: "#2A2B2E",
  street: "#34332F",
  medium: "#45433D",
  major: "#57544C",
  motorway: "#68645A",
  rail: "#3C3A35",
  label: "#8D867A",
  hood: "#DDD4C4",
  quarter: "#E8DFCE",
  district: "#8F8779",
  waterLabel: "#7E9FB6",
  parkLabel: "#93A67E",
  city: "#E8DFCE",
};

/** Hairlines: the streets stay thin even close in, like a printed plan. */
const HAIRLINE: Record<RoadGroup, Stops> = {
  service: [[15, 0.3], [17, 0.9], [19, 2]],
  minor: [[12, 0.25], [14, 0.6], [16, 1.2], [18, 2.4]],
  medium: [[11, 0.35], [13, 0.75], [15, 1.5], [18, 3.2]],
  major: [[9, 0.4], [12, 0.8], [15, 1.7], [18, 3.8]],
  motorway: [[7, 0.5], [11, 1], [15, 2.2], [18, 4.5]],
};

const STREET_COLOR: Record<RoadGroup, keyof EditorialPalette> = {
  service: "street",
  minor: "street",
  medium: "medium",
  major: "major",
  motorway: "motorway",
};

/** Engraved water lines: hairlines following the coast at growing distances, fading out. */
const WATER_LINES: [offset: number, opacity: number][] = [
  [3.5, 0.55],
  [8, 0.38],
  [13.5, 0.24],
  [20, 0.12],
];

export const editorial: MapTheme<EditorialPalette> = {
  id: "editorial",
  label: "Editorial cartography",
  palettes: { light: LIGHT, dark: DARK },
  tint: {
    land: [0.5, 0.02],
    building: [0.5, 0.022],
    sand: [0.4, 0.025],
    park: [0.25, 0.04],
    wood: [0.25, 0.04],
    water: [0.2, 0.05],
  },
  pitch: 0,
  layers(C) {
    const layers: LayerSpecification[] = [
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
        id: "park-edge",
        type: "line",
        source: "basemap",
        "source-layer": "park",
        minzoom: 12,
        paint: { "line-color": C.parkEdge, "line-width": ramp([[12, 0.3], [15, 0.7], [18, 1.2]]) },
      },
      {
        id: "water",
        type: "fill",
        source: "basemap",
        "source-layer": "water",
        filter: notTunnel,
        paint: { "fill-color": C.water },
      },
      ...WATER_LINES.map<LayerSpecification>(([offset, opacity], i) => ({
        id: `water-line-${i}`,
        type: "line",
        source: "basemap",
        "source-layer": "water",
        minzoom: 10.5,
        filter: ["all", notTunnel, classIn(["ocean", "river"])],
        layout: { "line-join": "round" },
        paint: {
          "line-color": C.waterLine,
          "line-width": 0.6,
          "line-offset": ramp([[10.5, offset * 0.6], [14, offset], [17, offset * 1.4]]),
          "line-opacity": byZoom(10.5, 0, 11.5, opacity),
        },
      })),
      {
        id: "coastline",
        type: "line",
        source: "basemap",
        "source-layer": "water",
        filter: ["all", notTunnel, ["!=", ["get", "class"], "swimming_pool"]],
        layout: { "line-join": "round" },
        paint: { "line-color": C.coast, "line-width": ramp([[8, 0.4], [12, 0.8], [16, 1.2]]) },
      },
      {
        id: "pier",
        type: "fill",
        source: "basemap",
        "source-layer": "transportation",
        filter: ["all", isPolygon, ["==", ["get", "class"], "pier"]],
        paint: { "fill-color": C.land, "fill-outline-color": C.coast },
      },
      {
        id: "building",
        type: "fill",
        source: "basemap",
        "source-layer": "building",
        minzoom: 14.5,
        paint: {
          "fill-color": C.building,
          "fill-outline-color": C.buildingEdge,
          "fill-opacity": byZoom(14.5, 0, 15.5, 1),
        },
      },
      {
        id: "rail",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["all", isLine, classIn(["rail", "transit"]), notTunnel],
        paint: {
          "line-color": C.rail,
          "line-width": ramp([[12, 0.4], [16, 0.9]]),
          "line-dasharray": [6, 3],
        },
      },
      ...ROAD_ORDER.map<LayerSpecification>((g) => ({
        id: `road-${g}`,
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: ROAD_MIN_ZOOM[g],
        filter: roadFilter(g),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": C[STREET_COLOR[g]], "line-width": ramp(HAIRLINE[g]) },
      })),
      {
        id: "water-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "water_name",
        filter: ["==", ["geometry-type"], "Point"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT.serifItalic,
          "text-size": byZoom(8, 12, 14, 16),
          "text-letter-spacing": 0.14,
          "text-max-width": 7,
        },
        paint: { "text-color": C.waterLabel, "text-halo-color": halo(C.water, "80"), "text-halo-width": 1 },
      },
      {
        id: "road-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "transportation_name",
        minzoom: 14.5,
        filter: [
          "any",
          classIn(["motorway", "trunk", "primary", "secondary"]),
          ["all", classIn(["tertiary", "minor"]), [">=", ["zoom"], 16]],
        ],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT.sans,
          "text-size": byZoom(14.5, 9.5, 17, 11),
          "text-letter-spacing": 0.05,
          "symbol-placement": "line",
          "text-padding": 16,
        },
        paint: { "text-color": C.label, "text-halo-color": halo(C.land), "text-halo-width": 1.4 },
      },
      {
        id: "park-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "poi",
        minzoom: 12.5,
        filter: ["all", classIn(["park", "national_park"]), named],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT.serifItalic,
          "text-size": byZoom(12.5, 12, 16, 14.5),
          "text-max-width": 8,
          "text-padding": 10,
        },
        paint: { "text-color": C.parkLabel, "text-halo-color": halo(C.park, "cc"), "text-halo-width": 1.2 },
      },
      // The hero labels: every neighborhood in the serif.
      {
        id: "neighborhood-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "place",
        minzoom: 11.5,
        maxzoom: 17,
        // Districts hand over to the serif once their capitals fade.
        filter: ["any", classIn(["quarter", "neighbourhood"]), ["all", ["==", ["get", "class"], "suburb"], [">=", ["zoom"], 13.5]]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT.serif,
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11.5,
            ["match", ["get", "class"], ["quarter", "suburb"], 12.5, 11],
            15,
            ["match", ["get", "class"], ["quarter", "suburb"], 19, 16],
          ],
          "text-line-height": 1.05,
          "text-max-width": 6,
          "text-padding": 6,
          "symbol-sort-key": ["match", ["get", "class"], ["quarter", "suburb"], 0, 1],
        },
        paint: {
          "text-color": ["match", ["get", "class"], ["quarter", "suburb"], C.quarter, C.hood],
          "text-halo-color": halo(C.land),
          "text-halo-width": 1.6,
          "text-opacity": byZoom(16, 1, 17, 0),
        },
      },
      // Districts in spaced capitals, placed ahead of the neighborhoods, stepping aside for them as you zoom in.
      {
        id: "district-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "place",
        minzoom: 11,
        maxzoom: 14,
        filter: ["==", ["get", "class"], "suburb"],
        layout: {
          "text-field": ["upcase", ["get", "name"]],
          "text-font": FONT.semibold,
          "text-size": byZoom(11, 9.5, 13.5, 11),
          "text-letter-spacing": 0.32,
          "text-max-width": 9,
          "text-padding": 12,
        },
        paint: {
          "text-color": C.district,
          "text-halo-color": halo(C.land),
          "text-halo-width": 1.4,
          "text-opacity": byZoom(13, 1, 14, 0),
        },
      },
      {
        id: "city-label",
        type: "symbol",
        source: "basemap",
        "source-layer": "place",
        maxzoom: 11.5,
        filter: classIn(["city", "town"]),
        layout: {
          "text-field": ["upcase", ["get", "name"]],
          "text-font": FONT.serif,
          "text-size": byZoom(6, 11, 11, 16),
          "text-letter-spacing": 0.2,
          "text-max-width": 10,
        },
        paint: { "text-color": C.city, "text-halo-color": halo(C.land), "text-halo-width": 1.6 },
      },
      pinFootprintLayer(),
    ];
    return layers;
  },
};
