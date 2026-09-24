import { maplibreProvider } from "./maplibre-provider";
import type { MapProvider } from "./types";

export type { LngLat, MapInstance, MapPadding, MapProvider } from "./types";

/** San Francisco, framed so the city fills a phone screen. */
export const DEFAULT_VIEW = { center: { lng: -122.4376, lat: 37.7749 }, zoom: 12 };

/**
 * MapLibre + OpenFreeMap needs no account or key. To switch to Apple MapKit JS
 * later, implement MapProvider with MapKit and return it here.
 */
export function getMapProvider(): MapProvider {
  return maplibreProvider;
}
