import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";

import { easeOutQuart, OPEN_CAMERA_MS, prefersReducedMotion } from "@/lib/motion";

import { routeTiles } from "./route-tiles";
import { buildMapStyle, type ColorScheme, type PinFootprint, type TileSource } from "./style";
import { MAP_THEMES, currentMapTheme, type MapThemeId } from "./theme";
import { PIN_SOURCE, missingImage, pinCollection } from "./themes/kit";
import { WATERCOLOR_TEXTURES, type WatercolorTexture } from "./themes/watercolor";
import { createTilePrefetcher } from "./tile-prefetch";
import type {
  LngLat,
  MapCreateOptions,
  MapInstance,
  MapPadding,
  MapProvider,
} from "./types";

type MapLibre = typeof import("maplibre-gl");

const LOAD_TIMEOUT_MS = 20000;

/** The San Francisco tiles in public/offline-tiles, served by the app itself; OpenFreeMap only when asked for. */
function tileSource(): TileSource {
  return process.env.NEXT_PUBLIC_MAP_TILES === "openfreemap" ? "openfreemap" : "offline";
}

/** Shrinks padding if panels would leave too little room to fit anything. */
function safePadding(map: MapLibreMap, padding: MapPadding, margin: number): MapPadding {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const fit = (a: number, b: number, size: number) => {
    const total = a + b + margin * 2;
    const room = Math.max(size - 80, 0);
    const scale = total > room ? room / total : 1;
    return [(a + margin) * scale, (b + margin) * scale];
  };
  const [left, right] = fit(padding.left, padding.right, w);
  const [top, bottom] = fit(padding.top, padding.bottom, h);
  return { top, right, bottom, left };
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const scheme = (): ColorScheme => (darkQuery().matches ? "dark" : "light");

/** Framed this close, a theme that tilts (dimensional, Apple) leans the camera in. */
const TILT_FROM_ZOOM = 13.5;
/** A glide to a place farther than this many screen diagonals flies instead. */
const GLIDE_REACH = 1.5;

interface MapEnvironment {
  theme: MapThemeId;
  terrain: boolean;
}

async function hasTerrain(): Promise<boolean> {
  try {
    return (await fetch("/offline-terrain/tiles.json", { method: "HEAD" })).ok;
  } catch {
    return false;
  }
}

function createMap(lib: MapLibre, options: MapCreateOptions, env: MapEnvironment): MapInstance {
  const theme = MAP_THEMES[env.theme];
  let tint: string | null = null;
  let pins: PinFootprint[] = [];
  const style = () =>
    buildMapStyle({
      theme: env.theme,
      tiles: tileSource(),
      origin: window.location.origin,
      scheme: scheme(),
      tint,
      terrain: env.terrain,
      pins,
    });

  const map = new lib.Map({
    container: options.container,
    style: style(),
    center: [options.center.lng, options.center.lat],
    zoom: options.zoom,
    minZoom: 8,
    maxZoom: 18.5,
    maxPitch: theme.pitch ? 60 : 0,
    // Room for the tiles loaded ahead along both swipe routes (see prefetchRoutes) next to the ones on screen.
    maxTileCacheZoomLevels: 14,
    // Nothing is drawn over the map; the data credit lives in the list and the rail (MapCredit).
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: theme.pitch > 0,
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  // Painted textures are files, fetched once each however many tiles ask at the same time.
  const textures = new Map<string, Promise<void>>();
  const loadTexture = (id: string): Promise<void> | undefined => {
    const texture = WATERCOLOR_TEXTURES[id as WatercolorTexture];
    if (!texture) return undefined;
    const pending = textures.get(id);
    if (pending) return pending;
    const loading = map
      .loadImage(texture.url)
      .then(({ data }) => {
        if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: texture.pixelRatio });
      })
      .catch(() => {
        textures.delete(id);
      });
    textures.set(id, loading);
    return loading;
  };
  // Textures, markers, and the pins' collision boxes are drawn on demand.
  // A resolver, not the styleimagemissing event: only a resolver can answer the tile that's asking.
  map.setMissingStyleImageResolver((id) => {
    const image = missingImage(id);
    if (image) {
      if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: image.pixelRatio });
      return;
    }
    return loadTexture(id);
  });
  // Ask for a textured theme's paint before its first tiles do.
  if (env.theme === "watercolor") for (const id of Object.keys(WATERCOLOR_TEXTURES)) void loadTexture(id);

  // setStyle diffs against the current style, so a new tint only updates paint colors, which crossfade.
  const restyle = () => map.setStyle(style());
  darkQuery().addEventListener("change", restyle);

  // The swipe between places pans across town at street zoom: its tiles load ahead, while the map rests.
  const prefetcher = createTilePrefetcher(map, "basemap");
  let routeTargets: LngLat[] | null = null;
  const prefetch = () => {
    const source = prefetcher.range();
    if (!routeTargets || !source || map.isMoving()) return;
    const { lng, lat } = map.getCenter();
    const { clientWidth: width, clientHeight: height } = map.getContainer();
    prefetcher.want(
      routeTiles({ start: { lng, lat, zoom: map.getZoom() }, targets: routeTargets, view: { width, height, padding }, source }),
    );
  };
  map.on("idle", prefetch);
  let prefetchTimer = 0;

  const markers = new Map<string, Marker>();
  let padding: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };
  let loaded = false;

  const timeout = window.setTimeout(() => {
    if (!loaded) options.onError(new Error("The map took too long to load"));
  }, LOAD_TIMEOUT_MS);

  map.once("load", () => {
    loaded = true;
    window.clearTimeout(timeout);
    options.onReady();
    options.onZoomChange?.(map.getZoom());
    options.onMove?.();
  });
  map.on("zoomend", () => options.onZoomChange?.(map.getZoom()));
  map.on("move", () => options.onMove?.());
  map.on("resize", () => options.onMove?.());
  map.on("error", (event) => {
    // After the first render, a missing tile is not worth an error screen.
    if (!loaded) options.onError(new Error(event.error?.message ?? "Map failed to load"));
  });
  // Pins take no pointer events of their own: every tap reaches the map, which asks which pin it meant.
  map.on("click", (event) => {
    if (options.onTap?.({ x: event.point.x, y: event.point.y })) return;
    options.onBackgroundClick?.();
  });
  map.on("mousemove", (event) => options.onHover?.({ x: event.point.x, y: event.point.y }));
  map.on("mouseout", () => options.onHover?.(null));

  const toArray = (p: LngLat): [number, number] => [p.lng, p.lat];

  return {
    addMarker(id, position, element) {
      markers.get(id)?.remove();
      markers.set(
        id,
        new lib.Marker({ element, anchor: "center" }).setLngLat(toArray(position)).addTo(map),
      );
    },
    removeMarker(id) {
      markers.get(id)?.remove();
      markers.delete(id);
    },
    setPadding(next) {
      padding = next;
    },
    focus(position, { minZoom = 15, glide = false } = {}) {
      const camera = {
        center: toArray(position),
        zoom: Math.max(map.getZoom(), minZoom),
        offset: [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2] as [number, number],
        ...(theme.pitch && { pitch: theme.pitch }),
        essential: true,
      };
      if (prefersReducedMotion()) {
        map.jumpTo(camera);
        return;
      }
      const { x, y } = map.project(camera.center);
      const { clientWidth: w, clientHeight: h } = map.getContainer();
      const reach = Math.hypot(x - w / 2, y - h / 2) / Math.hypot(w, h);
      // A tap, or a step to a nearby place: one long ease-out, no flyover swoop.
      // Farther than the screen, a gentle flight so it still feels like a move, not a wait.
      if (glide || reach < GLIDE_REACH * 1.6) {
        const duration = glide ? 920 : Math.round(760 + Math.min(reach, 1) * (OPEN_CAMERA_MS - 760));
        map.easeTo({ ...camera, duration, easing: easeOutQuart });
        return;
      }
      map.flyTo({ ...camera, curve: 1.2, speed: 0.72, maxDuration: 1500, easing: easeOutQuart });
    },
    fitTo(positions, { animate = true, maxZoom = 15 } = {}) {
      if (positions.length === 0) return;
      const bounds = new lib.LngLatBounds();
      for (const p of positions) bounds.extend(toArray(p));
      const fit = { padding: safePadding(map, padding, 56), maxZoom };
      const zoom = theme.pitch ? (map.cameraForBounds(bounds, fit)?.zoom ?? 0) : 0;
      map.fitBounds(bounds, {
        ...fit,
        ...(theme.pitch && { pitch: zoom >= TILT_FROM_ZOOM ? theme.pitch * 0.85 : 0 }),
        duration: animate ? 800 : 0,
        essential: true,
      });
    },
    zoomBy(delta) {
      map.easeTo({ zoom: map.getZoom() + delta, duration: 250 });
    },
    project(position) {
      const { x, y } = map.project(toArray(position));
      return { x, y };
    },
    size() {
      const { clientWidth: width, clientHeight: height } = map.getContainer();
      return { width, height };
    },
    zoom() {
      return map.getZoom();
    },
    camera() {
      const { lng, lat } = map.getCenter();
      return { lng, lat, zoom: map.getZoom() };
    },
    jumpCamera({ lng, lat, zoom }) {
      map.jumpTo({ center: [lng, lat], zoom });
    },
    stopCamera() {
      map.stop();
    },
    padding() {
      return padding;
    },
    prefetchRoutes(targets) {
      routeTargets = targets;
      window.clearTimeout(prefetchTimer);
      // A camera still moving gets there on its own "idle".
      if (targets) prefetchTimer = window.setTimeout(prefetch, 0);
    },
    setTint(color) {
      if (color === tint) return;
      tint = color;
      restyle();
    },
    setPins(next) {
      const sameSet = next.length === pins.length && next.every((pin, i) => pin.id === pins[i].id);
      pins = next;
      (map.getSource(PIN_SOURCE) as GeoJSONSource | undefined)?.setData(pinCollection(pins));
      if (sameSet) return;
      // A different set of places (a filter changed) can bring back or leave out basemap landmarks and labels.
      const built = style();
      (map.getSource("landmarks") as GeoJSONSource | undefined)?.setData(
        (built.sources.landmarks as { data: GeoJSON.FeatureCollection }).data,
      );
      for (const layer of built.layers) {
        if (layer.type === "symbol" && layer.source === "basemap" && map.getLayer(layer.id)) {
          map.setFilter(layer.id, layer.filter ?? null);
        }
      }
    },
    resize() {
      map.resize();
    },
    destroy() {
      window.clearTimeout(timeout);
      window.clearTimeout(prefetchTimer);
      darkQuery().removeEventListener("change", restyle);
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      map.remove();
    },
  };
}

export const maplibreProvider: MapProvider = {
  id: "maplibre",
  async load() {
    const theme = currentMapTheme();
    const [lib, terrain] = await Promise.all([
      import("maplibre-gl"),
      MAP_THEMES[theme].hills ? hasTerrain() : Promise.resolve(false),
    ]);
    // Served from public/ by scripts/copy-maplibre-worker.mjs (runs on npm install).
    lib.setWorkerUrl(`/maplibre/${lib.getVersion()}/maplibre-gl-worker.mjs`);
    return (options) => createMap(lib, options, { theme, terrain });
  },
};
