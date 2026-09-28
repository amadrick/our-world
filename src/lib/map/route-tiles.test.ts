import { describe, expect, it } from "vitest";

import { ROUTE_TILE_CAP, routeTiles, tileKey, tilesInView, type TileSourceRange } from "./route-tiles";
import { cameraAt, planSwipeCamera, type Camera, type SwipeView } from "./swipe-camera";

// An iPhone map: pills 72 px on top, the 474 px half sheet at the bottom.
const view: SwipeView = { width: 393, height: 852, padding: { top: 72, right: 0, bottom: 482, left: 0 } };
const size = { width: view.width, height: view.height };
const basemap: TileSourceRange = { minzoom: 0, maxzoom: 15, tileSize: 512 };
const outerlands = { lng: -122.505035, lat: 37.760349 };
const pabu = { lng: -122.398521, lat: 37.793274 }; // across town
const hookFish = { lng: -122.506874, lat: 37.762341 }; // around the corner

const restingOn = (place: { lng: number; lat: number }, zoom: number): Camera =>
  cameraAt(planSwipeCamera({ start: { ...place, zoom }, to: place, view }), 1);

describe("route tiles", () => {
  it("picks the tiles a vector source shows at the current zoom", () => {
    const tiles = tilesInView({ ...outerlands, zoom: 14.5 }, size, basemap);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.z === 14 && t.overscaledZ === 14)).toBe(true);
    // Outerlands sits in z14 tile 2616/6333.
    expect(tiles.map(tileKey)).toContain("14/14/2616/6333");
  });

  it("overzooms past the source's last zoom", () => {
    const tiles = tilesInView({ ...outerlands, zoom: 16.4 }, size, basemap);
    expect(tiles.every((t) => t.z === 15 && t.overscaledZ === 16)).toBe(true);
  });

  it("covers everything on screen during the pan to a far neighbor and at its resting view", () => {
    const start = restingOn(outerlands, 14.5);
    const tiles = new Set(routeTiles({ start, targets: [pabu], view, source: basemap, cap: 1000 }).map(tileKey));
    const onScreenNow = new Set(tilesInView(start, size, basemap).map(tileKey));
    const plan = planSwipeCamera({ start, to: pabu, view });
    for (let p = 0; p <= 1; p += 0.001) {
      for (const tile of tilesInView(cameraAt(plan, p), size, basemap)) {
        const key = tileKey(tile);
        expect(tiles.has(key) || onScreenNow.has(key)).toBe(true);
      }
    }
  });

  it("stays within the cap, the resting views first, and leaves out what's on screen", () => {
    const start = restingOn(outerlands, 14.5);
    const tiles = routeTiles({ start, targets: [pabu, hookFish], view, source: basemap });
    expect(tiles.length).toBeLessThanOrEqual(ROUTE_TILE_CAP);
    const keys = tiles.map(tileKey);
    expect(new Set(keys).size).toBe(keys.length);
    const onScreenNow = new Set(tilesInView(start, size, basemap).map(tileKey));
    expect(keys.some((key) => onScreenNow.has(key))).toBe(false);
    const landing = tilesInView(cameraAt(planSwipeCamera({ start, to: pabu, view }), 1), size, basemap).map(tileKey);
    expect(keys.slice(0, landing.length)).toEqual(landing);
  });

  it("needs nothing extra for a neighbor around the corner", () => {
    const start = restingOn(outerlands, 14.5);
    expect(routeTiles({ start, targets: [hookFish], view, source: basemap }).length).toBeLessThanOrEqual(2);
  });

  it("follows the zoom the map is at", () => {
    const at = (zoom: number) => routeTiles({ start: restingOn(outerlands, zoom), targets: [pabu], view, source: basemap, cap: 1000 });
    expect(at(13).every((t) => t.z === 13)).toBe(true);
    expect(at(16).every((t) => t.z === 15 && t.overscaledZ === 16)).toBe(true);
    expect(at(16).length).toBeGreaterThan(at(13).length);
  });
});
