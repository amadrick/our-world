/**
 * The bottom sheet's drag, as pure rules so they can be tested: when a touch
 * is a tap, how fast the finger was going, and which height the sheet settles
 * at when it lifts. Offsets are how far the sheet sits below full height, px.
 */
export type SheetSnap = "peek" | "mid" | "full";
const ORDER: SheetSnap[] = ["full", "mid", "peek"];

/** Total movement (px) that still counts as a tap. More than this and less than the axis lock settles back. */
export const TAP_SLOP = 4;
/** Velocity is read over this last stretch of the drag (ms). */
export const VELOCITY_WINDOW_MS = 80;
/** A flick this fast (px/ms)... */
export const FLICK_VELOCITY = 0.5;
/** ...over at least this distance (px) moves one step, even when the finger stopped short of halfway. */
export const FLICK_MIN_DISTANCE = 24;
/** How far ahead a release is projected along its velocity (ms) when finding the nearest height. */
export const PROJECT_MS = 180;
/** Past the peek by this much (px), a drag from full height dismisses instead of settling at half. */
export const DISMISS_PAST_PEEK = 36;

export type Sample = [time: number, y: number];

/** Velocity (px/ms, + is down) over the last VELOCITY_WINDOW_MS of samples. */
export function velocityOf(samples: readonly Sample[]): number {
  if (samples.length < 2) return 0;
  const [t1, y1] = samples[samples.length - 1];
  // The earliest sample still inside the window.
  let i = samples.length - 2;
  while (i > 0 && t1 - samples[i - 1][0] <= VELOCITY_WINDOW_MS) i--;
  const [t0, y0] = samples[i];
  return t1 > t0 ? (y1 - y0) / (t1 - t0) : 0;
}

/** The drag follows the finger 1:1 inside the range, and resists past either end. */
export function dragOffset(startOffset: number, dy: number, maxOffset: number): number {
  let offset = startOffset + dy;
  if (offset < 0) offset *= 0.25;
  if (offset > maxOffset) offset = maxOffset + (offset - maxOffset) * 0.25;
  return offset;
}

export function settleSheet({
  from,
  startOffset,
  offset,
  velocity,
  offsets,
}: {
  from: SheetSnap;
  startOffset: number;
  offset: number;
  velocity: number;
  offsets: Record<SheetSnap, number>;
}): SheetSnap | "dismiss" {
  const distance = offset - startOffset;
  // Only a drag that got somewhere is carried along its velocity: a tiny flick settles back.
  const projected = offset + (Math.abs(distance) >= FLICK_MIN_DISTANCE ? velocity * PROJECT_MS : 0);
  let next = ORDER.reduce((best, s) => (Math.abs(offsets[s] - projected) < Math.abs(offsets[best] - projected) ? s : best));
  const flick =
    Math.abs(velocity) >= FLICK_VELOCITY && Math.abs(distance) >= FLICK_MIN_DISTANCE && Math.sign(velocity) === Math.sign(distance);
  // A confident flick moves at least one step; a small or slow drag settles where it's nearest.
  if (next === from && flick) {
    const i = ORDER.indexOf(from) + (velocity > 0 ? 1 : -1);
    next = ORDER[Math.min(Math.max(i, 0), ORDER.length - 1)];
  }
  // The half sheet drags up to full or down to dismiss; it doesn't settle into the peek.
  if (from === "mid" && next === "peek") return "dismiss";
  if (from === "peek" && flick && velocity > 0 && offset > offsets.mid) return "dismiss";
  // Full height collapses to half; dragged nearly off screen, it dismisses.
  if (from === "full" && next === "peek") return offset > offsets.peek + DISMISS_PAST_PEEK ? "dismiss" : "mid";
  return next;
}
