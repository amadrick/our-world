/**
 * The basemap tiles a swipe between places will show, worked out ahead of time
 * so they can be loaded before the camera gets there: every tile on screen
 * along the straight pan from where the map is to each neighbor's resting view
 * above the sheet, at the zoom the map is at.
 */
import { cameraAt, mercator, planSwipeCamera, type Camera, type SwipeView } from "./swipe-camera";
import type { LngLat } from "./types";

export interface TileAddress {
  z: number;
  x: number;
  y: number;
  /** The zoom the tile is drawn for: above the source's last zoom, tiles are overzoomed. */
  overscaledZ: number;
}

export interface TileSourceRange {
  minzoom: number;
  maxzoom: number;
  /** A tile's width in px at its own zoom (512 for vector tiles). */
  tileSize: number;
}

/** At most this many tiles are loaded ahead for one resting place (both neighbors together). */
export const ROUTE_TILE_CAP = 48;

const TILE = 512;

/** The tiles a flat (unpitched) camera covers, as a vector source picks them. */
export function tilesInView(camera: Camera, size: { width: number; height: number }, source: TileSourceRange): TileAddress[] {
  const overscaledZ = Math.max(Math.floor(camera.zoom + Math.log2(TILE / source.tileSize)), source.minzoom);
  const z = Math.min(overscaledZ, source.maxzoom);
  const world = TILE * 2 ** camera.zoom;
  const span = world / 2 ** z;
  const c = mercator(camera);
  const last = 2 ** z - 1;
  const clamp = (n: number) => Math.min(Math.max(n, 0), last);
  const x0 = clamp(Math.floor((c.x * world - size.width / 2) / span));
  const x1 = clamp(Math.floor((c.x * world + size.width / 2) / span));
  const y0 = clamp(Math.floor((c.y * world - size.height / 2) / span));
  const y1 = clamp(Math.floor((c.y * world + size.height / 2) / span));
  const tiles: TileAddress[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push({ z, x, y, overscaledZ });
  return tiles;
}

export const tileKey = (t: TileAddress) => `${t.overscaledZ}/${t.z}/${t.x}/${t.y}`;

/**
 * The tiles to load ahead for swipes from `start` to each target, most useful
 * first: each neighbor's resting view, then the pans, nearest the start first
 * and alternating between the neighbors. Tiles on screen now are left out.
 */
export function routeTiles({
  start,
  targets,
  view,
  source,
  cap = ROUTE_TILE_CAP,
}: {
  start: Camera;
  targets: LngLat[];
  view: SwipeView;
  source: TileSourceRange;
  cap?: number;
}): TileAddress[] {
  const size = { width: view.width, height: view.height };
  const seen = new Set(tilesInView(start, size, source).map(tileKey));
  const out: TileAddress[] = [];
  const take = (tiles: TileAddress[]) => {
    for (const tile of tiles) {
      const key = tileKey(tile);
      if (seen.has(key) || out.length >= cap) continue;
      seen.add(key);
      out.push(tile);
    }
  };
  const plans = targets.map((to) => planSwipeCamera({ start, to, view }));
  for (const plan of plans) take(tilesInView(cameraAt(plan, 1), size, source));
  // Samples close enough that the views overlap: a quarter screen apart, at most.
  const world = TILE * 2 ** start.zoom;
  const step = Math.max(Math.min(view.width, view.height) / 4, 1);
  const samples = plans.map((plan) => {
    const px = Math.hypot(plan.end.x - plan.start.x, plan.end.y - plan.start.y) * world;
    return Math.min(Math.ceil(px / step), 400);
  });
  for (let i = 1; out.length < cap && i < Math.max(0, ...samples); i++) {
    plans.forEach((plan, j) => {
      if (i < samples[j]) take(tilesInView(cameraAt(plan, i / samples[j]), size, source));
    });
  }
  return out;
}
