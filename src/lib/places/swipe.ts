/**
 * Stepping from one place to the next with a horizontal swipe (or the arrow
 * keys): the order, and the gesture math. Pure, so it's tested on its own.
 */

export type StepDirection = -1 | 1;

/**
 * The places before and after `id` in `order` (the filtered list, as List
 * view shows it). No wrapping: the first has no previous, the last no next.
 * A place that isn't in the order (a deep link the filters hide) steps into
 * the list from its start.
 */
export function placeNeighbors<T extends { id: string }>(
  order: readonly T[],
  id: string | null,
): { prev: T | null; next: T | null; index: number } {
  const index = id ? order.findIndex((p) => p.id === id) : -1;
  if (index === -1) return { prev: null, next: order[0] ?? null, index };
  return { prev: order[index - 1] ?? null, next: order[index + 1] ?? null, index };
}

/** Movement (px) before a gesture commits to an axis. */
export const AXIS_SLOP = 10;
/** How much more one axis must move than the other to win it. */
const AXIS_RATIO = 1.2;

/**
 * Which axis a drag belongs to, once it has moved far enough to tell: "x" for
 * stepping between places, "y" for scrolling or dragging the sheet. Null
 * while it's too small or too diagonal to call; the caller asks again as the
 * pointer moves, and once decided, the axis holds for the whole gesture.
 */
export function lockAxis(dx: number, dy: number, slop = AXIS_SLOP): "x" | "y" | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < slop) return null;
  if (ax > ay * AXIS_RATIO) return "x";
  if (ay > ax * AXIS_RATIO) return "y";
  // Diagonal: vertical wins, so scrolling never turns into a step by accident.
  return Math.max(ax, ay) >= slop * 2 ? "y" : null;
}

/**
 * Rubber-banding past an end: the content still follows the finger, with more
 * resistance the further it goes, never beyond `limit` (the iOS curve).
 */
export function rubberBand(offset: number, limit: number, stiffness = 0.55): number {
  if (limit <= 0) return 0;
  const pull = (1 - 1 / ((Math.abs(offset) * stiffness) / limit + 1)) * limit;
  return Math.sign(offset) * pull;
}

/** How far the content moves for a drag of `dx`: freely toward a neighbor, rubber-banded where there is none. */
export function swipeOffset(dx: number, width: number, hasPrev: boolean, hasNext: boolean): number {
  const towardNext = dx < 0;
  const open = towardNext ? hasNext : hasPrev;
  return open ? dx : rubberBand(dx, width);
}

/** A drag past this share of the width steps. */
const DISTANCE = 0.22;
/** A flick at least this fast (px/ms) steps, if it has moved at least MIN_FLICK px. */
const VELOCITY = 0.4;
const MIN_FLICK = 24;

/**
 * Where a released swipe settles: 1 steps to the next place (swiped left),
 * -1 to the previous (swiped right), 0 springs back. It steps when dragged
 * far enough or flicked fast enough in the same direction, and only if there
 * is a place that way.
 */
export function swipeOutcome({
  dx,
  velocity,
  width,
  hasPrev,
  hasNext,
}: {
  dx: number;
  velocity: number;
  width: number;
  hasPrev: boolean;
  hasNext: boolean;
}): StepDirection | 0 {
  const far = Math.abs(dx) > width * DISTANCE;
  const flick = Math.abs(velocity) > VELOCITY && Math.abs(dx) > MIN_FLICK && Math.sign(velocity) === Math.sign(dx);
  if (!far && !flick) return 0;
  if (dx < 0 && hasNext) return 1;
  if (dx > 0 && hasPrev) return -1;
  return 0;
}
