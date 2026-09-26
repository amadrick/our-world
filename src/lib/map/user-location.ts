const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;

/** Ground meters one CSS pixel covers at a latitude and MapLibre zoom (512 px tiles). */
export function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

/** Diameter in px of the accuracy halo around the reader's dot, clamped to stay a halo. */
export function accuracyHaloPx(accuracy: number, lat: number, zoom: number, max = 640): number {
  if (!(accuracy > 0)) return 0;
  return Math.min(max, Math.round((2 * accuracy) / metersPerPixel(lat, zoom)));
}
