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
  type Expr,
  type MapTheme,
  type Stops,
} from "./kit";

/**
 * (h) Watercolor, an experiment (Andy's reference, a hand-painted map of SF):
 * warm paper with a visible tooth, a mottled blue bay that pools darker along
 * the shore, sienna washes over the built-up city with paper left showing for
 * the streets, sage and deep green parks, and soft ochre strokes for the
 * arterials. Each wash is a flat color (so the open place's tint still
 * crossfades it) under a see-through pigment texture from
 * scripts/generate-watercolor-textures.mjs. Patterns are anchored to the map,
 * so the paint stays put while it pans.
 */
const LIGHT = {
  land: "#F7EFDD",
  sand: "#EFDDB4",
  built: "#DA9368",
  works: "#E3BA92",
  building: "#BC5E40",
  pool: "#9A4128",
  park: "#B4CC8F",
  wood: "#7FA56C",
  parkPool: "#4C7A40",
  water: "#8DB4DC",
  shore: "#41709F",
  major: "#EEC170",
  freeway: "#E6B160",
  ferry: "#5F8DBF",
  hood: "#5E4030",
  streetLabel: "#6E4E3A",
  waterLabel: "#2C5A8C",
  parkLabel: "#3B6334",
  labelHalo: "#F7EFDD",
};

type WatercolorPalette = typeof LIGHT;

/** The same painting by lamplight: walnut paper, an inky bay, umber blocks, and dim olive parks. */
const DARK: WatercolorPalette = {
  land: "#26221D",
  sand: "#332C22",
  built: "#57352A",
  works: "#4C3D2D",
  building: "#6C3E2E",
  pool: "#2E1A13",
  park: "#33432B",
  wood: "#283A22",
  parkPool: "#17240F",
  water: "#203852",
  shore: "#10203A",
  major: "#86683A",
  freeway: "#97733C",
  ferry: "#4A6E96",
  hood: "#D9C7B3",
  streetLabel: "#C8B6A2",
  waterLabel: "#93B4D6",
  parkLabel: "#A3BE92",
  labelHalo: "#26221D",
};

/** The textures in public/textures/watercolor, by the image id the layers ask for. */
export const WATERCOLOR_TEXTURES = {
  "wc-water": { url: "/textures/watercolor/water.webp", pixelRatio: 1 },
  "wc-brick": { url: "/textures/watercolor/brick.webp", pixelRatio: 1 },
  "wc-park": { url: "/textures/watercolor/park.webp", pixelRatio: 1 },
  "wc-paper": { url: "/textures/watercolor/paper.webp", pixelRatio: 1 },
  "wc-grain": { url: "/textures/watercolor/grain.webp", pixelRatio: 2 },
} as const;
export type WatercolorTexture = keyof typeof WATERCOLOR_TEXTURES;

const BUILT = ["residential"];
const WORKS = ["commercial", "retail", "industrial", "railway", "school", "college", "university", "hospital", "military"];
const GREEN = ["pitch", "playground", "stadium", "cemetery", "zoo"];

const fill = (
  id: string,
  sourceLayer: string,
  filter: Expr | FilterSpecification | undefined,
  paint: Record<string, unknown>,
  minzoom?: number,
): LayerSpecification =>
  ({
    id,
    type: "fill",
    source: "basemap",
    "source-layer": sourceLayer,
    ...(minzoom !== undefined && { minzoom }),
    ...(filter && { filter }),
    paint,
  }) as LayerSpecification;

/** Inside a wash's edge: lines on a polygon run clockwise, so a positive offset falls inside it. */
const pooledEdge = (
  id: string,
  sourceLayer: string,
  filter: Expr | FilterSpecification | undefined,
  color: string,
  width: Stops,
  opacity: Expr | number,
  minzoom?: number,
): LayerSpecification =>
  ({
    id,
    type: "line",
    source: "basemap",
    "source-layer": sourceLayer,
    ...(minzoom !== undefined && { minzoom }),
    ...(filter && { filter }),
    layout: { "line-join": "round" },
    paint: {
      "line-color": color,
      "line-width": ramp(width),
      // Half the width inward, so the stroke stays inside the wash (and off the tiles' clipped edges).
      "line-offset": ramp(width.map(([z, w]) => [z, w / 2])),
      "line-blur": ramp(width.map(([z, w]) => [z, w * 0.8])),
      "line-opacity": opacity,
    },
  }) as LayerSpecification;

const roadFilter = (classes: string[]): FilterSpecification =>
  ["all", isLine, notTunnel, classIn(classes)] as FilterSpecification;

/** Streets are the paper left between the blocks; only the arterials get a stroke of their own. */
const GAPS: { id: string; classes: string[]; minzoom: number; width: Stops }[] = [
  { id: "service", classes: ["service"], minzoom: 15, width: [[15, 0.8], [17, 2.4], [19, 6]] },
  { id: "street", classes: ["minor"], minzoom: 12.5, width: [[12.5, 0.4], [14, 1.5], [15, 2.4], [17, 5], [19, 11]] },
  { id: "tertiary", classes: ["tertiary"], minzoom: 11, width: [[11, 0.4], [13, 1.1], [14, 2], [15, 3], [17, 6.5], [19, 14]] },
];
const STROKES: { id: string; classes: string[]; minzoom: number; width: Stops; color: "major" | "freeway" }[] = [
  { id: "major", classes: ["secondary", "primary", "trunk"], minzoom: 9, width: [[9, 0.5], [12, 1.4], [14, 2.6], [15, 3.6], [17, 8], [19, 18]], color: "major" },
  { id: "freeway", classes: ["motorway"], minzoom: 7, width: [[7, 0.6], [10, 1.4], [12, 2.2], [14, 3.4], [15, 4.6], [17, 10], [19, 22]], color: "freeway" },
];

export const watercolor: MapTheme<WatercolorPalette> = {
  id: "watercolor",
  label: "Watercolor",
  palettes: { light: LIGHT, dark: DARK },
  tint: {
    land: [0.3, 0.012],
    sand: [0.3, 0.015],
    built: [0.2, 0.02],
    works: [0.2, 0.02],
    building: [0.2, 0.02],
    park: [0.15, 0.03],
    wood: [0.15, 0.03],
    water: [0.15, 0.03],
    labelHalo: [0.3, 0.012],
  },
  pitch: 0,
  layers(C, { scheme }) {
    const dark = scheme === "dark";
    const texture = dark ? 0.55 : 1;
    return [
      { id: "background", type: "background", paint: { "background-color": C.land } },
      { id: "paper", type: "background", paint: { "background-pattern": "wc-paper", "background-opacity": texture } },

      /*
       * The city. Zoomed out, a sienna wash over the built-up landuse, a paler
       * ochre over works and campuses. Closer in, the tiles' landuse leaves
       * whole districts bare, so the wash spreads under all the land instead:
       * the streets drawn in paper above it cut it into blocks, and parks and
       * water paint over it.
       */
      { id: "blocks", type: "background", paint: { "background-color": C.built, "background-opacity": byZoom(13, 0, 14.5, 0.66) } },
      { id: "blocks-wash", type: "background", paint: { "background-pattern": "wc-brick", "background-opacity": byZoom(13, 0, 14.5, texture) } },
      fill("built", "landuse", classIn(BUILT), { "fill-color": C.built, "fill-opacity": byZoom(9, 0.5, 13, 0.62, 14.5, 0) }),
      fill("works", "landuse", classIn(WORKS), { "fill-color": C.works, "fill-opacity": byZoom(9, 0.55, 13, 0.7, 14.5, 0.5) }),
      fill("built-wash", "landuse", classIn([...BUILT, ...WORKS]), { "fill-pattern": "wc-brick", "fill-opacity": byZoom(13, texture, 14.5, 0) }),
      pooledEdge("built-pool", "landuse", classIn([...BUILT, ...WORKS]), C.pool, [[10, 1], [13, 2], [15, 3.5]], byZoom(10, 0.18, 13, 0.28, 14.5, 0)),
      fill("sand", "landcover", ["==", ["get", "class"], "sand"], { "fill-color": C.sand }),

      // Parks: a sage wash that pools to deep green at its edges; woods darker.
      fill("park", "park", undefined, { "fill-color": C.park }),
      fill("greenery", "landcover", classIn(["grass", "wetland"]), { "fill-color": C.park }),
      fill("woods", "landcover", classIn(["wood"]), { "fill-color": C.wood }),
      fill("pitch", "landuse", classIn(GREEN), { "fill-color": C.park }, 13),
      fill("park-wash", "park", undefined, { "fill-pattern": "wc-park", "fill-opacity": texture }),
      fill("greenery-wash", "landcover", classIn(["grass", "wetland", "wood"]), { "fill-pattern": "wc-park", "fill-opacity": texture }),
      pooledEdge("park-pool", "park", undefined, C.parkPool, [[10, 1], [13, 2], [15, 3.5]], byZoom(10, 0.25, 14, 0.4)),

      // Water: an uneven blue wash, darker where it pools against the shore.
      fill("water", "water", notTunnel, { "fill-color": C.water, "fill-antialias": false }),
      fill("water-wash", "water", notTunnel, { "fill-pattern": "wc-water", "fill-opacity": texture, "fill-antialias": false }),
      pooledEdge("shore-bloom", "water", notTunnel, C.shore, [[8, 2.4], [11, 4.5], [13, 7], [15, 7.5]], byZoom(8, 0.12, 13, 0.16)),
      pooledEdge("shore", "water", notTunnel, C.shore, [[8, 0.8], [11, 1.4], [13, 2.2], [15, 3]], byZoom(8, 0.35, 13, 0.45)),
      {
        id: "waterway",
        type: "line",
        source: "basemap",
        "source-layer": "waterway",
        minzoom: 12,
        paint: { "line-color": C.water, "line-width": ramp([[12, 0.8], [16, 2.2], [18, 4]]), "line-blur": 0.6 },
      },
      fill("pier", "transportation", ["all", isPolygon, ["==", ["get", "class"], "pier"]], { "fill-color": C.land }),

      // Up close each building is its own wash, darker than the block around it, pooled at its walls.
      fill("building", "building", undefined, { "fill-color": C.building, "fill-opacity": byZoom(15, 0, 15.6, 0.62) }, 15),
      fill("building-wash", "building", undefined, { "fill-pattern": "wc-brick", "fill-opacity": byZoom(15, 0, 15.6, texture) }, 15),
      {
        id: "building-pool",
        type: "line",
        source: "basemap",
        "source-layer": "building",
        minzoom: 15,
        paint: {
          "line-color": C.pool,
          "line-width": byZoom(15, 0.6, 18, 1.4),
          "line-blur": byZoom(15, 0.6, 18, 1.2),
          "line-opacity": byZoom(15, 0, 15.6, 0.32),
        },
      },

      {
        id: "ferry",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["all", isLine, ["==", ["get", "class"], "ferry"]],
        paint: { "line-color": C.ferry, "line-width": byZoom(11, 0.6, 16, 1.1), "line-dasharray": [3, 3], "line-opacity": 0.6 },
      },
      // Pigment gathers along each block's side where the paper of the street stops it.
      ...GAPS.map<LayerSpecification>((r) => ({
        id: `road-pool-${r.id}`,
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: Math.max(r.minzoom, 13.5),
        filter: roadFilter(r.classes),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": C.pool,
          "line-width": ramp(r.width.map(([z, w]) => [z, w + 2.2])),
          "line-blur": 1.4,
          "line-opacity": byZoom(13.5, 0, 14.5, 0.3),
        },
      })),
      ...GAPS.map<LayerSpecification>((r) => ({
        id: `road-${r.id}`,
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: r.minzoom,
        filter: roadFilter(r.classes),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": C.land, "line-width": ramp(r.width), "line-blur": 0.5 },
      })),
      ...STROKES.map<LayerSpecification>((r) => ({
        id: `road-${r.id}`,
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        minzoom: r.minzoom,
        filter: roadFilter(r.classes),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": C[r.color],
          "line-width": ramp(r.width),
          "line-blur": ramp(r.width.map(([z, w]) => [z, w * 0.35])),
          "line-opacity": 0.9,
        },
      })),

      // The paper's tooth over every wash, under the labels.
      { id: "grain", type: "background", paint: { "background-pattern": "wc-grain", "background-opacity": dark ? 0.3 : 1 } },
      ...filmLabels(C, "crisp"),
      pinFootprintLayer(),
    ];
  },
};
