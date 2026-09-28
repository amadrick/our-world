import { describe, expect, it } from "vitest";

import {
  cameraAt,
  mercator,
  planSwipeCamera,
  settleDuration,
  swipeEase,
  type Camera,
  type SwipeView,
} from "./swipe-camera";

// An iPhone map: pills 72 px on top, the 474 px half sheet at the bottom.
const view: SwipeView = { width: 393, height: 852, padding: { top: 72, right: 0, bottom: 482, left: 0 } };
const tartine = { lng: -122.4241, lat: 37.7614 };
const biRite = { lng: -122.4258, lat: 37.7616 }; // two blocks away
const coitTower = { lng: -122.4058, lat: 37.8024 }; // across town

/** Where a place lands on screen under a camera. */
function screen(place: { lng: number; lat: number }, camera: Camera) {
  const size = 512 * 2 ** camera.zoom;
  const m = mercator(place);
  const c = mercator(camera);
  return { x: (m.x - c.x) * size + view.width / 2, y: (m.y - c.y) * size + view.height / 2 };
}

const startAt = (place: { lng: number; lat: number }, zoom: number): Camera => {
  // The resting camera on a place: centered in the map above the sheet.
  const plan = planSwipeCamera({ start: { ...place, zoom }, to: place, view });
  return cameraAt(plan, 1);
};

describe("swipe camera", () => {
  it("only pans between near places, landing the neighbor above the sheet", () => {
    const start = startAt(tartine, 15);
    const plan = planSwipeCamera({ start, to: biRite, view });
    for (const p of [0, 0.25, 0.5, 0.75, 1]) expect(cameraAt(plan, p).zoom).toBe(15);
    const landed = screen(biRite, cameraAt(plan, 1));
    expect(landed.x).toBeCloseTo(view.width / 2, 3);
    expect(landed.y).toBeCloseTo((view.padding.top + view.height - view.padding.bottom) / 2, 3);
  });

  it("only pans between far places too, at the current zoom, landing the neighbor above the sheet", () => {
    for (const to of [coitTower, { lng: -122.5107, lat: 37.7594 }]) {
      const start = startAt(tartine, 15);
      const plan = planSwipeCamera({ start, to, view });
      for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) expect(cameraAt(plan, p).zoom).toBe(15);
      const landed = screen(to, cameraAt(plan, 1));
      expect(landed.x).toBeCloseTo(view.width / 2, 3);
      expect(landed.y).toBeCloseTo((view.padding.top + view.height - view.padding.bottom) / 2, 3);
    }
  });

  it("moves the map straight across, evenly with progress", () => {
    const plan = planSwipeCamera({ start: startAt(tartine, 15), to: coitTower, view });
    const a = mercator(cameraAt(plan, 0));
    const m = mercator(cameraAt(plan, 0.5));
    const b = mercator(cameraAt(plan, 1));
    expect(m.x).toBeCloseTo((a.x + b.x) / 2, 12);
    expect(m.y).toBeCloseTo((a.y + b.y) / 2, 12);
  });

  it("gives the same view for the same progress, so dragging back reverses it exactly", () => {
    const plan = planSwipeCamera({ start: startAt(tartine, 15), to: coitTower, view });
    const there = cameraAt(plan, 0.6);
    cameraAt(plan, 0.9);
    expect(cameraAt(plan, 0.6)).toEqual(there);
    expect(cameraAt(plan, 0)).toEqual(expect.objectContaining({ zoom: 15 }));
    const start = cameraAt(plan, 0);
    expect(start.lng).toBeCloseTo(startAt(tartine, 15).lng, 9);
  });

  it("clamps progress to the swipe, and keeps whatever zoom the user is at", () => {
    for (const zoom of [12, 13, 16.5]) {
      const plan = planSwipeCamera({ start: startAt(tartine, zoom), to: coitTower, view });
      expect(cameraAt(plan, -0.4)).toEqual(cameraAt(plan, 0));
      expect(cameraAt(plan, 1.7)).toEqual(cameraAt(plan, 1));
      expect(cameraAt(plan, 1).zoom).toBe(zoom);
    }
  });

  it("eases the release like the cards and scales its length by what's left", () => {
    expect(swipeEase(0)).toBe(0);
    expect(swipeEase(1)).toBe(1);
    // An ease-out: most of the way early, so a flick keeps its speed.
    expect(swipeEase(0.25)).toBeGreaterThan(0.6);
    expect(settleDuration(1)).toBe(450);
    expect(settleDuration(0.5)).toBe(355);
    expect(settleDuration(0)).toBe(260);
  });
});
