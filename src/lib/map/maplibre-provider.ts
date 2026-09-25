import type { Map as MapLibreMap, Marker } from "maplibre-gl";

import { buildMapStyle, type ColorScheme, type TileSource } from "./style";
import type {
  LngLat,
  MapCreateOptions,
  MapInstance,
  MapPadding,
  MapProvider,
} from "./types";

type MapLibre = typeof import("maplibre-gl");

const LOAD_TIMEOUT_MS = 20000;

function tileSource(): TileSource {
  return process.env.NEXT_PUBLIC_MAP_TILES === "offline" ? "offline" : "openfreemap";
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

function createMap(lib: MapLibre, options: MapCreateOptions): MapInstance {
  const map = new lib.Map({
    container: options.container,
    style: buildMapStyle(tileSource(), window.location.origin, scheme()),
    center: [options.center.lng, options.center.lat],
    zoom: options.zoom,
    minZoom: 8,
    maxZoom: 18.5,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();

  let tint: string | null = null;
  // setStyle diffs against the current style, so a new tint only updates paint colors, which crossfade.
  const restyle = () => map.setStyle(buildMapStyle(tileSource(), window.location.origin, scheme(), tint));
  darkQuery().addEventListener("change", restyle);

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
  map.on("click", (event) => {
    const target = event.originalEvent.target as HTMLElement | null;
    if (target?.closest(".maplibregl-marker")) return;
    options.onBackgroundClick?.();
  });

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
    focus(position, { minZoom = 15 } = {}) {
      map.flyTo({
        center: toArray(position),
        zoom: Math.max(map.getZoom(), minZoom),
        offset: [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2],
        speed: 1.6,
        curve: 1.25,
        essential: true,
      });
    },
    fitTo(positions, { animate = true, maxZoom = 15 } = {}) {
      if (positions.length === 0) return;
      const bounds = new lib.LngLatBounds();
      for (const p of positions) bounds.extend(toArray(p));
      map.fitBounds(bounds, {
        padding: safePadding(map, padding, 56),
        maxZoom,
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
    setTint(color) {
      if (color === tint) return;
      tint = color;
      restyle();
    },
    resize() {
      map.resize();
    },
    destroy() {
      window.clearTimeout(timeout);
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
    const lib = await import("maplibre-gl");
    // Served from public/ by scripts/copy-maplibre-worker.mjs (runs on npm install).
    lib.setWorkerUrl(`/maplibre/${lib.getVersion()}/maplibre-gl-worker.mjs`);
    return (options) => createMap(lib, options);
  },
};
