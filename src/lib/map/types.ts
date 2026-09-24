export interface LngLat {
  lng: number;
  lat: number;
}

export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapCreateOptions {
  container: HTMLElement;
  center: LngLat;
  zoom: number;
  onReady: () => void;
  onError: (error: Error) => void;
  onBackgroundClick?: () => void;
  /** Fires once the map is ready and after every zoom, with the new zoom level. */
  onZoomChange?: (zoom: number) => void;
}

/**
 * The small surface the app needs from a map. MapLibre implements it today;
 * an Apple MapKit JS provider can implement the same methods later.
 */
export interface MapInstance {
  /** Places a caller-owned DOM element (the pin) centered on a position. */
  addMarker(id: string, position: LngLat, element: HTMLElement): void;
  removeMarker(id: string): void;
  /** Screen space covered by panels or sheets; camera moves keep content clear of it. */
  setPadding(padding: MapPadding): void;
  focus(position: LngLat, options?: { minZoom?: number }): void;
  fitTo(positions: LngLat[], options?: { animate?: boolean; maxZoom?: number }): void;
  zoomBy(delta: number): void;
  resize(): void;
  destroy(): void;
}

export interface MapProvider {
  id: string;
  /** Lazily loads the map library so it never blocks the first paint. */
  load(): Promise<(options: MapCreateOptions) => MapInstance>;
}
