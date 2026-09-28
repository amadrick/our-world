import { describe, expect, it } from "vitest";

import {
  ARRIVAL_MIN_ZOOM,
  MIN_DIP_ZOOM,
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
const visible = (p: { x: number; y: number }) =>
  p.x >= 0 && p.x <= view.width && p.y >= view.padding.top && p.y <= view.height - view.padding.bottom;

const startAt = (place: { lng: number; lat: number }, zoom: number): Camera => {
  // The resting camera on a place: centered in the map above the sheet.
  const plan = planSwipeCamera({ start: { ...place, zoom }, from: place, to: place, view });
  return cameraAt(plan, 1);
};

describe("swipe camera", () => {
  it("only pans between near places, landing the neighbor above the sheet", () => {
    const start = startAt(tartine, 15);
    const plan = planSwipeCamera({ start, from: tartine, to: biRite, view });
    expect(plan.dip).toBe(0);
    for (const p of [0, 0.25, 0.5, 0.75, 1]) expect(cameraAt(plan, p).zoom).toBeCloseTo(15, 6);
    const landed = screen(biRite, cameraAt(plan, 1));
    expect(landed.x).toBeCloseTo(view.width / 2, 3);
    expect(landed.y).toBeCloseTo((view.padding.top + view.height - view.padding.bottom) / 2, 3);
  });

  it("dips out for far places so both are in view halfway, then lands at the arrival zoom", () => {
    const start = startAt(tartine, 15);
    const plan = planSwipeCamera({ start, from: tartine, to: coitTower, view });
    expect(plan.dip).toBeGreaterThan(1);
    const middle = cameraAt(plan, 0.5);
    expect(middle.zoom).toBeLessThan(14);
    expect(middle.zoom).toBeGreaterThanOrEqual(MIN_DIP_ZOOM);
    expect(visible(screen(tartine, middle))).toBe(true);
    expect(visible(screen(coitTower, middle))).toBe(true);
    expect(cameraAt(plan, 1).zoom).toBeCloseTo(15, 6);
    // The arc is smooth: it goes out, then comes back in.
    const zooms = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map((p) => cameraAt(plan, p).zoom);
    for (let i = 1; i < zooms.length; i++) expect(zooms[i]).toBeLessThan(zooms[i - 1]);
  });

  it("dips further for farther places, never past the city view", () => {
    const start = startAt(tartine, 15);
    const near = planSwipeCamera({ start, from: tartine, to: { lng: -122.4241, lat: 37.772 }, view });
    const far = planSwipeCamera({ start, from: tartine, to: coitTower, view });
    const beach = planSwipeCamera({ start, from: tartine, to: { lng: -122.5107, lat: 37.7594 }, view });
    expect(near.dip).toBeLessThan(far.dip);
    expect(far.dip).toBeLessThanOrEqual(beach.dip);
    expect(cameraAt(beach, 0.5).zoom).toBeGreaterThanOrEqual(MIN_DIP_ZOOM - 1e-9);
  });

  it("gives the same view for the same progress, so dragging back reverses it exactly", () => {
    const plan = planSwipeCamera({ start: startAt(tartine, 15), from: tartine, to: coitTower, view });
    const there = cameraAt(plan, 0.6);
    cameraAt(plan, 0.9);
    expect(cameraAt(plan, 0.6)).toEqual(there);
    expect(cameraAt(plan, 0)).toEqual(expect.objectContaining({ zoom: 15 }));
    const start = cameraAt(plan, 0);
    expect(start.lng).toBeCloseTo(startAt(tartine, 15).lng, 9);
  });

  it("clamps progress to the swipe, and lands at least at the arrival zoom", () => {
    const plan = planSwipeCamera({ start: startAt(tartine, 13), from: tartine, to: biRite, view });
    expect(cameraAt(plan, -0.4)).toEqual(cameraAt(plan, 0));
    expect(cameraAt(plan, 1.7)).toEqual(cameraAt(plan, 1));
    expect(cameraAt(plan, 1).zoom).toBe(ARRIVAL_MIN_ZOOM);
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
