/**
 * The pin-tap choreography. The camera, the sheet, and the map tint share one
 * soft ease-out and land together; the numbers match the CSS durations in
 * globals.css (`--open-camera`, `--open-sheet`, `--open-tint`, `--open-pin`).
 */

/** How the camera eases to a tapped pin. */
export const OPEN_CAMERA_MS = 1080;
/** The sheet's rise. A little shorter than the camera, so it settles as the frame arrives. */
export const OPEN_SHEET_MS = 860;
/** The map's wash of the place's color. */
export const OPEN_TINT_MS = 780;

/** Ease-out quart: quick to leave, long soft landing. MapLibre takes a function, not a bezier. */
export function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
