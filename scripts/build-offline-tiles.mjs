#!/usr/bin/env node
// Builds a small offline copy of the San Francisco basemap for networks that
// can't reach tiles.openfreemap.org (for example locked-down CI or cloud VMs).
//
// It reads the public Protomaps planet build over HTTP range requests,
// converts each tile from the Protomaps schema to the OpenMapTiles schema that
// OpenFreeMap serves (so the app's map style renders unchanged), and writes the
// result plus the label fonts to public/offline-tiles/. Enable it with
// NEXT_PUBLIC_MAP_TILES=offline.
//
// Usage: node scripts/build-offline-tiles.mjs

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { fromVectorTileJs } from "@maplibre/vt-pbf";

const SOURCE_URL =
  process.env.PROTOMAPS_URL ??
  "https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/protomaps/openstreetmap/v4.pmtiles";
const FONTS_BASE_URL =
  "https://raw.githubusercontent.com/openmaptiles/fonts/gh-pages";
const FONTS = ["Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"];
const FONT_RANGES = ["0-255", "256-511", "8192-8447"];

const OUT_DIR = path.resolve("public/offline-tiles");
const BAY_AREA = [-123.1, 37.2, -121.6, 38.3];
const SAN_FRANCISCO = [-122.56, 37.69, -122.34, 37.86];
const MAX_ZOOM = 15;

function lngLatToTile(lng, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  );
  return [x, y];
}

function tilesFor(z) {
  const [w, s, e, n] = z <= 10 ? BAY_AREA : SAN_FRANCISCO;
  const [x0, y0] = lngLatToTile(w, n, z);
  const [x1, y1] = lngLatToTile(e, s, z);
  const tiles = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) tiles.push([z, x, y]);
  }
  return tiles;
}

const GRASS = new Set([
  "grass", "grassland", "meadow", "garden", "golf_course", "dog_park",
  "recreation_ground", "village_green", "allotments", "scrub", "heath",
]);
const PARK = new Set(["park", "national_park", "nature_reserve", "protected_area"]);
const WOOD = new Set(["wood", "forest"]);
const LANDUSE = new Set([
  "residential", "commercial", "industrial", "retail", "railway", "military",
  "cemetery", "hospital", "school", "university", "college", "kindergarten",
  "stadium", "pitch", "playground", "zoo", "theme_park", "sports_centre",
]);
const ROAD_CLASS = {
  motorway: "motorway", trunk: "trunk", primary: "primary",
  secondary: "secondary", tertiary: "tertiary", residential: "minor",
  unclassified: "minor", living_street: "minor", road: "minor",
  service: "service", track: "track",
};
const TRANSIT = new Set(["light_rail", "subway", "tram", "monorail", "funicular"]);

function roadAttributes(p) {
  const detail = String(p.kind_detail ?? "");
  const base = detail.replace(/_link$/, "");
  let cls;
  let subclass;
  if (p.kind === "path") {
    cls = "path";
    subclass = detail || "path";
  } else if (p.kind === "rail") {
    cls = TRANSIT.has(detail) ? "transit" : "rail";
    subclass = detail || "rail";
  } else if (p.kind === "ferry") {
    cls = "ferry";
  } else {
    cls = ROAD_CLASS[base] ?? (p.kind === "highway" ? "motorway" : "minor");
  }
  const attrs = { class: cls };
  if (subclass) attrs.subclass = subclass;
  if (p.is_bridge) attrs.brunnel = "bridge";
  else if (p.is_tunnel) attrs.brunnel = "tunnel";
  if (detail.endsWith("_link")) attrs.ramp = 1;
  if (p.oneway) attrs.oneway = 1;
  return attrs;
}

function placeClass(p) {
  const detail = String(p.kind_detail ?? "");
  if (p.kind === "country") return "country";
  if (p.kind === "region") return "state";
  if (p.kind === "locality") {
    return ["city", "town", "village", "hamlet"].includes(detail) ? detail : "village";
  }
  if (p.kind === "macrohood") return "quarter";
  if (p.kind === "neighbourhood") return detail === "suburb" ? "suburb" : "neighbourhood";
  return null;
}

function waterClass(p) {
  const kind = String(p.kind ?? "");
  const detail = String(p.kind_detail ?? "");
  if (kind === "ocean") return "ocean";
  if (kind === "dock") return "dock";
  if (kind === "swimming_pool" || detail === "swimming_pool") return "swimming_pool";
  if (kind === "river" || detail === "river" || detail === "riverbank") return "river";
  return "lake";
}

function convertTile(buffer) {
  const source = new VectorTile(new PbfReader(new Uint8Array(buffer)));
  const out = {};
  const push = (layer, feature, properties, extent) => {
    out[layer] ??= { name: layer, extent, features: [] };
    out[layer].features.push({
      id: feature.id,
      type: feature.type,
      properties,
      loadGeometry: () => feature.loadGeometry(),
    });
  };

  for (const [name, layer] of Object.entries(source.layers)) {
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const p = f.properties;
      const kind = String(p.kind ?? "");
      const named = p.name ? { name: p.name } : {};

      switch (name) {
        case "water":
          if (f.type === 3) push("water", f, { class: waterClass(p) }, layer.extent);
          else if (f.type === 2) push("waterway", f, { class: kind || "stream", ...named }, layer.extent);
          else if (f.type === 1 && p.name && kind !== "fountain") {
            const cls = kind === "water" ? "lake" : kind;
            push("water_name", f, { class: cls, ...named }, layer.extent);
          }
          break;
        case "landuse":
        case "landcover":
          if (f.type !== 3) break;
          if (PARK.has(kind)) push("park", f, { class: kind }, layer.extent);
          else if (GRASS.has(kind)) push("landcover", f, { class: "grass", subclass: kind }, layer.extent);
          else if (WOOD.has(kind)) push("landcover", f, { class: "wood", subclass: kind }, layer.extent);
          else if (kind === "wetland" || kind === "marsh") push("landcover", f, { class: "wetland" }, layer.extent);
          else if (kind === "beach" || kind === "sand" || kind === "barren") push("landcover", f, { class: "sand" }, layer.extent);
          else if (kind === "pier") push("transportation", f, { class: "pier" }, layer.extent);
          else if (["aerodrome", "runway", "taxiway", "apron"].includes(kind)) push("aeroway", f, { class: kind }, layer.extent);
          else if (LANDUSE.has(kind)) push("landuse", f, { class: kind }, layer.extent);
          break;
        case "buildings":
          if (f.type === 3) {
            push("building", f, { render_height: Number(p.height ?? 6), render_min_height: Number(p.min_height ?? 0) }, layer.extent);
          }
          break;
        case "roads": {
          if (f.type !== 2) break;
          const attrs = roadAttributes(p);
          push("transportation", f, attrs, layer.extent);
          if (p.name) push("transportation_name", f, { ...attrs, ...named }, layer.extent);
          break;
        }
        case "places": {
          const cls = placeClass(p);
          if (cls && p.name) {
            const rank = Math.max(1, 16 - Number(p.population_rank ?? 1));
            push("place", f, { class: cls, rank, ...named }, layer.extent);
          }
          break;
        }
        case "pois":
          if (p.name) push("poi", f, { class: kind, subclass: String(p.kind_detail ?? kind), ...named }, layer.extent);
          break;
        case "boundaries": {
          const level = { country: 2, region: 4, county: 6, locality: 8 }[kind];
          if (level) push("boundary", f, { admin_level: level }, layer.extent);
          break;
        }
      }
    }
  }

  const layers = {};
  for (const [name, l] of Object.entries(out)) {
    layers[name] = {
      name,
      extent: l.extent,
      version: 2,
      length: l.features.length,
      feature: (i) => l.features[i],
    };
  }
  return fromVectorTileJs({ layers });
}

async function buildTiles() {
  const archive = new PMTiles(SOURCE_URL);
  const jobs = [];
  for (let z = 0; z <= MAX_ZOOM; z++) jobs.push(...tilesFor(z));
  console.log(`Converting ${jobs.length} tiles from ${SOURCE_URL}`);

  let done = 0;
  let bytes = 0;
  const queue = [...jobs];
  async function worker() {
    while (queue.length) {
      const [z, x, y] = queue.shift();
      const tile = await archive.getZxy(z, x, y);
      if (!tile?.data) continue;
      const encoded = convertTile(tile.data);
      const dir = path.join(OUT_DIR, String(z), String(x));
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${y}.pbf`), encoded);
      bytes += encoded.byteLength;
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${jobs.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`Wrote ${done} tiles (${(bytes / 1e6).toFixed(1)} MB)`);
}

async function buildFonts() {
  for (const font of FONTS) {
    const dir = path.join(OUT_DIR, "fonts", font);
    await mkdir(dir, { recursive: true });
    for (const range of FONT_RANGES) {
      const url = `${FONTS_BASE_URL}/${encodeURIComponent(`Klokantech ${font}`)}/${range}.pbf`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Font download failed (${res.status}): ${url}`);
      await writeFile(path.join(dir, `${range}.pbf`), Buffer.from(await res.arrayBuffer()));
    }
  }
  console.log(`Wrote ${FONTS.length} fonts`);
}

await buildFonts();
await buildTiles();
