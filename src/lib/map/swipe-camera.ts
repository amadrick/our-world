/**
 * The map's camera during a swipe between places, as a pure function of the
 * swipe's progress p (0 = the open place, 1 = the neighbor). The center moves
 * straight across the screen (in Web Mercator), from wherever the map is to
 * the neighbor's resting view above the sheet, at the zoom the user is at:
 * near or far, it only pans. A slow drag scrubs it; a release animates the
 * rest with the same curve as the cards.
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
  zoom: number;
  /** The camera center's offset from that point, in screen px (the sheet and pills). */
  shift: { x: number; y: number };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** How far the middle of the map above the sheet sits from the container's center, px. */
const shiftOf = (padding: MapPadding) => ({ x: (padding.left - padding.right) / 2, y: (padding.top - padding.bottom) / 2 });

export function planSwipeCamera({
  start,
  to,
  view,
}: {
  /** The camera as the swipe begins. */
  start: Camera;
  /** The neighbor being swiped to. */
  to: LngLat;
  view: SwipeView;
}): SwipePlan {
  const size = worldSize(start.zoom);
  const shift = shiftOf(view.padding);
  const c = mercator(start);
  // Where the start camera's view is centered above the sheet; the end is the neighbor itself.
  const focus = { x: c.x + shift.x / size, y: c.y + shift.y / size };
  return { start: focus, end: mercator(to), zoom: start.zoom, shift };
}

/** The camera at progress p (clamped to 0–1): the same p always gives the same view, so dragging back reverses it. */
export function cameraAt(plan: SwipePlan, p: number): Camera {
  const t = Math.min(Math.max(p, 0), 1);
  const { zoom } = plan;
  // The focus point moves straight across; the camera sits off it by the sheet's shift.
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
