/**
 * The map's camera during a swipe between places, as a pure function of the
 * swipe's progress p (0 = the open place, 1 = the neighbor). The center moves
 * straight across the screen (in Web Mercator), from wherever the map is to
 * the neighbor's resting view above the sheet. Near neighbors only pan; far
 * ones dip out in zoom along an arc so both are in view halfway, and land at
 * the arrival zoom. A slow drag scrubs it; a release animates the rest with
 * the same curve as the cards.
 */
import type { LngLat, MapPadding } from "./types";

export interface Camera {
  lng: number;
  lat: number;
  zoom: number;
}

export interface SwipeView {
  width: number;
  height: number;
  /** Screen covered by the pills and the sheet: the place lands centered in what's left. */
  padding: MapPadding;
}

/** Two places closer than this share of the visible map (each axis) only pan. */
export const NEAR_FRACTION = 0.4;
/** At the dip's deepest, both places fit in this share of the visible map. */
export const FIT_FRACTION = 0.8;
/** The dip never goes out past the city view. */
export const MIN_DIP_ZOOM = 11.5;
/** The zoom a step between places lands at, at least (as the camera's focus does). */
export const ARRIVAL_MIN_ZOOM = 14.5;
/** Past the last ready neighbor, the map follows the rubber-banded card this much. */
export const RUBBER_CAMERA = 0.25;
/** The release curve, shared by the cards (CSS --ease-out-soft) and the map. */
export const SWIPE_EASE = [0.22, 1, 0.36, 1] as const;

const TILE = 512;
const worldSize = (zoom: number) => TILE * 2 ** zoom;

export function mercator({ lng, lat }: LngLat): { x: number; y: number } {
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: (lng + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) };
}

export function unmercator({ x, y }: { x: number; y: number }): LngLat {
  return { lng: x * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI };
}

export interface SwipePlan {
  /** The point in the middle of the map above the sheet, at the start and at the end (Mercator). */
  start: { x: number; y: number };
  end: { x: number; y: number };
  startZoom: number;
  endZoom: number;
  /** How far below the straight zoom line the arc dips at its middle. 0 for a near pair. */
  dip: number;
  /** The camera center's offset from that point, in screen px (the sheet and pills). */
  shift: { x: number; y: number };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** How far the middle of the map above the sheet sits from the container's center, px. */
const shiftOf = (padding: MapPadding) => ({ x: (padding.left - padding.right) / 2, y: (padding.top - padding.bottom) / 2 });

export function planSwipeCamera({
  start,
  from,
  to,
  view,
}: {
  /** The camera as the swipe begins. */
  start: Camera;
  /** The open place and the neighbor being swiped to. */
  from: LngLat;
  to: LngLat;
  view: SwipeView;
}): SwipePlan {
  const endZoom = Math.max(start.zoom, ARRIVAL_MIN_ZOOM);
  const a = mercator(from);
  const b = mercator(to);
  // The pair's distance on screen at the starting zoom, against the map left above the sheet.
  const size = worldSize(start.zoom);
  const dx = Math.abs(b.x - a.x) * size;
  const dy = Math.abs(b.y - a.y) * size;
  const w = Math.max(view.width - view.padding.left - view.padding.right, 1);
  const h = Math.max(view.height - view.padding.top - view.padding.bottom, 1);
  let dip = 0;
  if (dx > w * NEAR_FRACTION || dy > h * NEAR_FRACTION) {
    const fit = Math.min(dx ? (w * FIT_FRACTION) / dx : Infinity, dy ? (h * FIT_FRACTION) / dy : Infinity);
    const middle = (start.zoom + endZoom) / 2;
    const deepest = Math.max(Math.min(middle, start.zoom + Math.log2(fit)), Math.min(MIN_DIP_ZOOM, middle));
    dip = Math.max(0, middle - deepest);
  }
  const shift = shiftOf(view.padding);
  const c = mercator(start);
  // Where the start camera's view is centered above the sheet; the end is the neighbor itself.
  const focus = { x: c.x + shift.x / size, y: c.y + shift.y / size };
  return { start: focus, end: b, startZoom: start.zoom, endZoom, dip, shift };
}

/** The camera at progress p (clamped to 0–1): the same p always gives the same view, so dragging back reverses it. */
export function cameraAt(plan: SwipePlan, p: number): Camera {
  const t = Math.min(Math.max(p, 0), 1);
  const zoom = lerp(plan.startZoom, plan.endZoom, t) - plan.dip * 4 * t * (1 - t);
  // The focus point moves straight across; the camera sits off it by the sheet's shift at this frame's zoom.
  const size = worldSize(zoom);
  const { lng, lat } = unmercator({
    x: lerp(plan.start.x, plan.end.x, t) - plan.shift.x / size,
    y: lerp(plan.start.y, plan.end.y, t) - plan.shift.y / size,
  });
  return { lng, lat, zoom };
}

/** How long a release takes to cover what's left of the swipe: 260–450 ms. */
export function settleDuration(remaining: number): number {
  const r = Math.min(Math.max(remaining, 0), 1);
  return Math.round(260 + 190 * r);
}

/** CSS cubic-bezier timing, so the map eases exactly as the cards do. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bez = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  const slope = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * (1 - t) * t + 3 * (1 - b) * t ** 2;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = bez(x1, x2, t) - x;
      const d = slope(x1, x2, t);
      if (Math.abs(err) < 1e-6 || d === 0) break;
      t = Math.min(Math.max(t - err / d, 0), 1);
    }
    return bez(y1, y2, t);
  };
}

export const swipeEase = cubicBezier(...SWIPE_EASE);
