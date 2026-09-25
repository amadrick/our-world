#!/usr/bin/env node
// MapLibre GL v6 loads its web worker from a separate ES module that bundlers
// don't emit. Copy it into public/ (versioned, so upgrades bust caches) and the
// map provider points MapLibre at it with setWorkerUrl().

import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("node_modules/maplibre-gl/dist");
const { version } = JSON.parse(
  await readFile(path.resolve("node_modules/maplibre-gl/package.json"), "utf8"),
);
const dest = path.resolve("public/maplibre", version);

await mkdir(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(path.join(dist, file), path.join(dest, file));
}
console.log(`Copied MapLibre ${version} worker to public/maplibre/${version}`);
