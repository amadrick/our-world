/**
 * One decision per touch about which way it goes, shared by every gesture that
 * listens to it (the sheet's vertical drag and the horizontal swipe between
 * places), so they can never both move, or both give up.
 */
import { lockAxis } from "@/lib/places/swipe";

/** Movement (px) before a touch commits to an axis. */
export const GESTURE_SLOP = 8;

const decided = new Map<number, "x" | "y">();

/** The touch's axis once it has moved far enough to tell; the first answer holds for the whole touch. */
export function gestureAxis(pointerId: number, dx: number, dy: number): "x" | "y" | null {
  const known = decided.get(pointerId);
  if (known) return known;
  const axis = lockAxis(dx, dy, GESTURE_SLOP);
  if (axis) decided.set(pointerId, axis);
  return axis;
}

/** Forget the touch when it lifts or is cancelled. */
export function endGesture(pointerId: number): void {
  decided.delete(pointerId);
}
