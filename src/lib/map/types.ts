export interface PinFootprint {
  id: string;
  lng: number;
  lat: number;
  kind: "photo" | "glyph";
  display: "hidden" | "icon" | "named";
  selected: boolean;
  name: string;
}

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
  /** A tap on the map, in px from its top left. Return true when it meant a pin, so it isn't a background tap. */
  onTap?: (point: ScreenPoint) => boolean;
  /** The pointer over the map (mouse only), or null when it leaves. */
  onHover?: (point: ScreenPoint | null) => void;
  /** Fires once the map is ready and after every zoom, with the new zoom level. */
  onZoomChange?: (zoom: number) => void;
  /** Fires on every frame the camera moves (pan, zoom, resize), and once when ready. */
  onMove?: () => void;
}

export interface ScreenPoint {
  x: number;
  y: number;
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
  /** Centers a position; `glide` eases there at the same zoom, for stepping from one place to the next. */
  focus(position: LngLat, options?: { minZoom?: number; glide?: boolean }): void;
  fitTo(positions: LngLat[], options?: { animate?: boolean; maxZoom?: number }): void;
  zoomBy(delta: number): void;
  /** Where a position is on screen right now, in px from the map's top left. */
  project(position: LngLat): ScreenPoint;
  /** The map's size on screen, in px. */
  size(): { width: number; height: number };
  zoom(): number;
  /** Where the camera is now. */
  camera(): { lng: number; lat: number; zoom: number };
  /** Moves the camera at once, for a camera driven frame by frame (the swipe between places). */
  jumpCamera(camera: { lng: number; lat: number; zoom: number }): void;
  /** Stops any camera animation in flight. */
  stopCamera(): void;
  /** The screen covered by panels and sheets, as last set. */
  padding(): MapPadding;
  /**
   * Loads ahead the basemap a swipe to each of these places would pan across,
   * from wherever the camera settles, and again after every move or zoom.
   * null holds off (a swipe is driving the camera) without dropping what's loading.
   */
  prefetchRoutes(targets: LngLat[] | null): void;
  /** Washes the whole basemap faintly in a color (an open place's), or back to neutral with null. */
  setTint(color: string | null): void;
  /** Where the pins are and what they show, so basemap labels keep out from under them. */
  setPins(pins: PinFootprint[]): void;
  resize(): void;
  destroy(): void;
}

export interface MapProvider {
  id: string;
  /** Lazily loads the map library so it never blocks the first paint. */
  load(): Promise<(options: MapCreateOptions) => MapInstance>;
}
