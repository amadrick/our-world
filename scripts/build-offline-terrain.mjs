#!/usr/bin/env node
// Builds elevation tiles for San Francisco's hills, so the "dimensional" map
// can shade them without a terrain service (none is reachable keyless, and
// locked-down networks block the rest).
//
// It downloads the USGS 3DEP 1 arc-second (~30 m) elevation model for the
// one-degree square that holds the city, samples it into 256px Web Mercator
// tiles, and writes them Terrarium-encoded (elevation = R*256 + G + B/256 -
// 32768) to public/offline-terrain/, with a tiles.json the map looks for. The
// map skips hillshade when that file is missing.
//
// Usage: node scripts/build-offline-terrain.mjs

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { fromArrayBuffer } from "geotiff";

const DEM_URL =
  process.env.DEM_URL ??
  "https://prd-tnm.s3.us-west-2.amazonaws.com/StagedProducts/Elevation/1/TIFF/current/n38w123/USGS_1_n38w123.tif";
const CACHE = path.join(os.tmpdir(), "usgs-1-n38w123.tif");
const OUT_DIR = path.resolve("public/offline-terrain");
/** The city, the Marin Headlands, and the East Bay hills across the water. */
const BOUNDS = [-122.62, 37.64, -122.18, 37.94];
const MIN_ZOOM = 8;
/** ~30 m per pixel at this latitude: the model's own resolution. The map overzooms past it. */
const MAX_ZOOM = 12;
const SIZE = 256;

const tileX = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
const tileY = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};
const pixelLng = (x, z) => (x / 2 ** z) * 360 - 180;
const pixelLat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

async function loadDem() {
  if (!existsSync(CACHE)) {
    console.log(`Downloading ${DEM_URL}`);
    const res = await fetch(DEM_URL);
    if (!res.ok) throw new Error(`Elevation download failed (${res.status})`);
    await writeFile(CACHE, Buffer.from(await res.arrayBuffer()));
  }
  const buffer = await readFile(CACHE);
  const tiff = await fromArrayBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const image = await tiff.getImage();
  const [originX, originY] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  const [west, south, east, north] = BOUNDS;
  const pad = 0.02;
  const x0 = Math.max(0, Math.floor((west - pad - originX) / resX));
  const x1 = Math.min(image.getWidth(), Math.ceil((east + pad - originX) / resX));
  const y0 = Math.max(0, Math.floor((north + pad - originY) / resY));
  const y1 = Math.min(image.getHeight(), Math.ceil((south - pad - originY) / resY));
  const [data] = await image.readRasters({ window: [x0, y0, x1, y1] });
  const width = x1 - x0;
  const height = y1 - y0;
  const noData = image.getGDALNoData();

  /** Bilinear elevation in meters; the sea and gaps read as 0. */
  return (lng, lat) => {
    const fx = (lng - originX) / resX - x0 - 0.5;
    const fy = (lat - originY) / resY - y0 - 0.5;
    const ix = Math.max(0, Math.min(width - 2, Math.floor(fx)));
    const iy = Math.max(0, Math.min(height - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - ix));
    const ty = Math.min(1, Math.max(0, fy - iy));
    const at = (x, y) => {
      const v = data[y * width + x];
      return v === noData || !Number.isFinite(v) || v < -100 ? 0 : Math.max(0, v);
    };
    const top = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
    const bottom = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

function png(width, height, rgb) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolor
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 3 + 1)] = 0;
    rgb.copy(rows, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const elevation = await loadDem();
let count = 0;
for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
  const [west, south, east, north] = BOUNDS;
  for (let x = tileX(west, z); x <= tileX(east, z); x++) {
    for (let y = tileY(north, z); y <= tileY(south, z); y++) {
      const rgb = Buffer.alloc(SIZE * SIZE * 3);
      for (let py = 0; py < SIZE; py++) {
        const lat = pixelLat(y + (py + 0.5) / SIZE, z);
        for (let px = 0; px < SIZE; px++) {
          const lng = pixelLng(x + (px + 0.5) / SIZE, z);
          // Half-meter steps: finer than hillshade can show, and far smaller files.
          const v = Math.round(elevation(lng, lat) * 2) / 2 + 32768;
          const i = (py * SIZE + px) * 3;
          rgb[i] = Math.floor(v / 256);
          rgb[i + 1] = Math.floor(v) % 256;
          rgb[i + 2] = Math.round((v - Math.floor(v)) * 256);
        }
      }
      const dir = path.join(OUT_DIR, String(z), String(x));
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${y}.png`), png(SIZE, SIZE, rgb));
      count++;
    }
  }
}
await writeFile(
  path.join(OUT_DIR, "tiles.json"),
  `${JSON.stringify(
    {
      tilejson: "3.0.0",
      name: "San Francisco elevation (USGS 3DEP 1 arc-second)",
      attribution: '<a href="https://www.usgs.gov/3d-elevation-program" target="_blank">USGS 3DEP</a>',
      tiles: ["/offline-terrain/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      bounds: BOUNDS,
      minzoom: MIN_ZOOM,
      maxzoom: MAX_ZOOM,
      tileSize: SIZE,
    },
    null,
    2,
  )}\n`,
);
console.log(`Wrote ${count} elevation tiles to ${OUT_DIR}`);
