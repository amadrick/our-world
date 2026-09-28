"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapIcon } from "react-feather";
import { useCallback, useEffect, useEffectEvent, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DEFAULT_VIEW, getMapProvider, type MapInstance, type MapPadding } from "@/lib/map";
import { resolveTap, type ShownPin, type TapResult } from "@/lib/map/pin-hit";
import { cameraAt, planSwipeCamera, swipeEase, type Camera, type SwipePlan } from "@/lib/map/swipe-camera";
import { layoutPins, type PinDisplay } from "@/lib/map/pin-layout";
import { APPLE_PINS, estimateText, pinKind, pinPalette, type PinPalette } from "@/lib/map/pin-style";
import { currentMapTheme } from "@/lib/map/theme";
import { accuracyHaloPx } from "@/lib/map/user-location";
import type { UserPosition } from "@/hooks/use-user-location";
import { isFavorite } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { MapPin } from "./map-pin";
import { placeColor } from "./place-detail";

export interface MapViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  showAll: () => void;
  /** Centers the selected place, e.g. after the map comes back into view. */
  focusSelected: () => void;
  /** Centers the reader's position, clear of the sheet and the pills. */
  locate: (position: UserPosition) => void;
  /**
   * The swipe between places drives the camera: `p` is how far the card has gone
   * toward the neighbor `toId` (0–1), or null when there's no neighbor that way.
   */
  swipeCamera: (toId: string | null, p: number) => void;
  /** The swipe was let go: ease what's left to `p` (1 lands on the neighbor, 0 goes back) in `durationMs`. */
  settleSwipeCamera: (p: number, durationMs: number) => void;
}

interface MapViewProps {
  ref?: React.Ref<MapViewHandle>;
  places: Place[];
  selectedId: string | null;
  highlightedId: string | null;
  padding: MapPadding;
  /** Changes whenever the filtered set changes, so the map re-frames the results. */
  fitKey: string;
  /** A filter is on: draw every matching pin, not only the ones the city zoom would keep. */
  showEveryPin?: boolean;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
  onBackgroundClick: () => void;
  /** The selection is a step to the next or previous place: the camera glides instead of flying. */
  glide?: boolean;
  /** The reader's position, drawn as a blue dot with its accuracy halo. */
  userPosition?: UserPosition | null;
  className?: string;
}

const USER_MARKER = "__user-location";

type Status = "loading" | "ready" | "error";

/** Past this zoom, pins that still tie are at one address: the nearest is picked instead of zooming. */
const CLUSTER_ZOOM_LIMIT = 17;

type Layout = Map<string, PinDisplay>;

const sameLayout = (a: Layout, b: Layout) =>
  a.size === b.size && [...a].every(([id, display]) => b.get(id) === display);

// Frames the main cluster, so one far-flung place (say, across the Bay) doesn't zoom the city out.
function framingSet(places: Place[]): Place[] {
  if (places.length <= 2) return places;
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const lat = median(places.map((p) => p.lat));
  const lng = median(places.map((p) => p.lng));
  const km = (p: Place) =>
    Math.hypot((p.lat - lat) * 111, (p.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180));
  const core = places.filter((p) => km(p) <= 10);
  return core.length ? core : places;
}

export function MapView({
  ref,
  places,
  selectedId,
  highlightedId,
  padding,
  fitKey,
  showEveryPin = false,
  onSelect,
  onHighlight,
  onBackgroundClick,
  glide = false,
  userPosition = null,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MapInstance | null>(null);
  const addedRef = useRef(new Set<string>());
  const framedRef = useRef(false);
  const [status, setStatus] = useState<Status>("loading");
  const [layout, setLayout] = useState<Layout>(() => new Map());
  const [palette, setPalette] = useState<PinPalette>(APPLE_PINS);
  const frameRef = useRef(0);
  // Pin DOM nodes live outside React's tree (the map positions them), so React renders into them via portals.
  const [pinElements] = useState(() => new Map<string, HTMLElement>());

  const pinElement = (id: string) => {
    let element = pinElements.get(id);
    if (!element) {
      element = document.createElement("div");
      pinElements.set(id, element);
    }
    return element;
  };

  const userElement = useRef<HTMLElement | null>(null);
  const sizeHalo = useEffectEvent(() => {
    const halo = userElement.current?.firstElementChild as HTMLElement | null | undefined;
    const instance = instanceRef.current;
    if (!halo || !instance || !userPosition) return;
    const size = accuracyHaloPx(userPosition.accuracy, userPosition.lat, instance.zoom());
    halo.style.width = halo.style.height = `${size}px`;
  });

  const handleBackgroundClick = useEffectEvent(() => onBackgroundClick());

  // Pin callbacks stay the same function across renders, so a pin re-renders only when its own state changes.
  const latest = useRef({ onSelect, onHighlight });
  useEffect(() => {
    latest.current = { onSelect, onHighlight };
  });
  const selectPin = useCallback((id: string) => latest.current.onSelect(id), []);
  const highlightPin = useCallback((id: string | null) => latest.current.onHighlight(id), []);

  const pinSpecs = useMemo(
    () =>
      new Map(
        places.map((place) => {
          const kind = pinKind(place.category);
          const favorite = isFavorite(place);
          const tier = favorite ? 1 : kind === "photo" ? 2 : 3;
          return [place.id, { kind, tier, large: favorite, text: estimateText(smartQuotes(place.name), kind) }] as const;
        }),
      ),
    [places],
  );

  // Like Apple Maps: landmarks and top places first, more icons as you zoom in, then names wherever they fit.
  const relayout = useEffectEvent(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const next = layoutPins(
      places.map((place) => ({
        id: place.id,
        ...instance.project(place),
        ...pinSpecs.get(place.id)!,
        forced: place.id === selectedId || place.id === highlightedId,
        selected: place.id === selectedId,
      })),
      instance.size(),
      instance.zoom(),
      { everyIcon: showEveryPin },
    );
    setLayout((current) => (sameLayout(current, next) ? current : next));
  });
  // Every tap on the map asks which pin it meant: the nearest to the finger, or a tie to zoom into.
  const shownPins = (): ShownPin[] => {
    const instance = instanceRef.current;
    if (!instance) return [];
    return places.map((place) => ({
      id: place.id,
      ...instance.project(place),
      ...pinSpecs.get(place.id)!,
      selected: place.id === selectedId,
      display: layout.get(place.id) ?? "hidden",
    }));
  };
  const handleTap = useEffectEvent((point: { x: number; y: number }): boolean => {
    const instance = instanceRef.current;
    if (!instance) return false;
    const result = resolveTap(shownPins(), point);
    if (result.kind === "none") return false;
    if (result.kind === "cluster" && instance.zoom() < CLUSTER_ZOOM_LIMIT) {
      const cluster = places.filter((place) => result.ids.includes(place.id));
      instance.fitTo(cluster, { maxZoom: Math.min(instance.zoom() + 3, 18) });
      return true;
    }
    latest.current.onSelect(result.kind === "pin" ? result.id : result.ids[0]);
    return true;
  });
  const hoveredRef = useRef<string | null>(null);
  const handleHover = useEffectEvent((point: { x: number; y: number } | null) => {
    // A touch also sends mouse events after the tap; only a real pointer hovers.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const result: TapResult = point ? resolveTap(shownPins(), point) : { kind: "none" };
    const id = result.kind === "pin" ? result.id : result.kind === "cluster" ? result.ids[0] : null;
    const canvas = containerRef.current?.querySelector<HTMLElement>(".maplibregl-canvas-container");
    if (canvas) canvas.style.cursor = id ? "pointer" : "";
    if (id === hoveredRef.current) return;
    hoveredRef.current = id;
    latest.current.onHighlight(id);
  });

  const scheduleLayout = useEffectEvent(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      relayout();
      sizeHalo();
    });
  });

  useEffect(() => {
    let cancelled = false;
    let instance: MapInstance | null = null;
    const added = addedRef.current;

    getMapProvider()
      .load()
      .then((create) => {
        if (cancelled || !containerRef.current) return;
        instance = create({
          container: containerRef.current,
          center: DEFAULT_VIEW.center,
          zoom: DEFAULT_VIEW.zoom,
          onReady: () => {
            instanceRef.current = instance;
            setPalette(pinPalette(currentMapTheme()));
            setStatus("ready");
            scheduleLayout();
          },
          onError: (error) => {
            console.error("Map failed to load:", error);
            setStatus("error");
          },
          onBackgroundClick: () => handleBackgroundClick(),
          onTap: (point) => handleTap(point),
          onHover: (point) => handleHover(point),
          onMove: () => scheduleLayout(),
        });
      })
      .catch((error) => {
        console.error("Map library failed to load:", error);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      instance?.destroy();
      instanceRef.current = null;
      added.clear();
      framedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const instance = instanceRef.current;
    if (status !== "ready" || !instance) return;
    const added = addedRef.current;
    const ids = new Set(places.map((p) => p.id));
    for (const id of added) {
      if (!ids.has(id)) {
        instance.removeMarker(id);
        added.delete(id);
      }
    }
    for (const place of places) {
      if (!added.has(place.id)) {
        instance.addMarker(place.id, place, pinElement(place.id));
        added.add(place.id);
      }
    }
    // pinElement is a stable accessor over a stable Map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, status]);

  useEffect(() => {
    if (status === "ready") relayout();
  }, [places, selectedId, highlightedId, showEveryPin, status]);

  useEffect(() => {
    if (status !== "ready") return;
    instanceRef.current?.setPins(
      places.map((place) => ({
        id: place.id,
        lng: place.lng,
        lat: place.lat,
        kind: pinKind(place.category),
        display: layout.get(place.id) ?? "hidden",
        selected: place.id === selectedId,
        name: smartQuotes(place.name),
      })),
    );
  }, [places, layout, selectedId, status]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (status !== "ready" || !instance) return;
    if (!userPosition) {
      instance.removeMarker(USER_MARKER);
      return;
    }
    if (!userElement.current) {
      const element = document.createElement("div");
      element.className = "user-location";
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", "Your location");
      element.innerHTML = '<span class="user-location-halo"></span><span class="user-location-dot"></span>';
      userElement.current = element;
    }
    instance.addMarker(USER_MARKER, userPosition, userElement.current);
    sizeHalo();
  }, [userPosition, status]);

  // An open place washes the whole map faintly in its color; closing it fades back.
  const selected = places.find((p) => p.id === selectedId);
  const tint = selected ? placeColor(selected) : null;
  useEffect(() => {
    if (status === "ready") instanceRef.current?.setTint(tint);
  }, [tint, status]);

  useEffect(() => {
    instanceRef.current?.setPadding(padding);
  }, [padding, status]);

  const frame = useEffectEvent((animate: boolean) => {
    instanceRef.current?.fitTo(framingSet(places), { animate, maxZoom: 15 });
  });

  useEffect(() => {
    if (status !== "ready") return;
    if (selectedId && !framedRef.current) {
      framedRef.current = true;
      return;
    }
    if (!selectedId) frame(framedRef.current);
    framedRef.current = true;
    // Re-frame only when the filters change, not on every selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, status]);

  // The camera during a swipe between places (see swipeCamera below).
  const swipeRef = useRef<{ start: Camera; toId: string | null; plan: SwipePlan | null; p: number } | null>(null);
  const swipeFrame = useRef(0);
  const landedRef = useRef<string | null>(null);

  const focusSelected = useEffectEvent(() => {
    const place = places.find((p) => p.id === selectedId);
    // A swipe already flew the camera here with the card; don't fly again.
    if (landedRef.current && landedRef.current === selectedId) {
      landedRef.current = null;
      return;
    }
    landedRef.current = null;
    if (place) instanceRef.current?.focus(place, { minZoom: 14.5, glide });
  });

  useEffect(() => {
    if (status === "ready" && selectedId) focusSelected();
  }, [selectedId, status]);

  // The camera during a swipe between places: planned once from where the map is, then
  // scrubbed with the card (one jumpTo per frame) and eased with it on release.
  const applySwipe = () => {
    swipeFrame.current = 0;
    const swipe = swipeRef.current;
    const instance = instanceRef.current;
    if (!swipe || !instance) return;
    instance.jumpCamera(swipe.plan ? cameraAt(swipe.plan, swipe.p) : swipe.start);
  };
  const swipeCamera = (toId: string | null, p: number) => {
    const instance = instanceRef.current;
    if (!instance || status !== "ready") return;
    if (!swipeRef.current) {
      instance.stopCamera();
      swipeRef.current = { start: instance.camera(), toId: null, plan: null, p: 0 };
    }
    const swipe = swipeRef.current;
    if (toId !== swipe.toId) {
      const from = places.find((place) => place.id === selectedId);
      const to = toId ? places.find((place) => place.id === toId) : undefined;
      swipe.toId = toId;
      swipe.plan =
        from && to ? planSwipeCamera({ start: swipe.start, from, to, view: { ...instance.size(), padding: instance.padding() } }) : null;
    }
    swipe.p = p;
    swipeFrame.current ||= requestAnimationFrame(applySwipe);
  };
  const settleSwipeCamera = (target: number, durationMs: number) => {
    const swipe = swipeRef.current;
    if (!swipe) return;
    cancelAnimationFrame(swipeFrame.current);
    swipeFrame.current = 0;
    const from = swipe.p;
    const began = performance.now();
    if (target === 1 && swipe.plan) landedRef.current = swipe.toId;
    const tick = (now: number) => {
      if (swipeRef.current !== swipe) return;
      const t = durationMs > 0 ? Math.min((now - began) / durationMs, 1) : 1;
      swipe.p = from + (target - from) * swipeEase(t);
      applySwipe();
      if (t < 1) swipeFrame.current = requestAnimationFrame(tick);
      else swipeRef.current = null;
    };
    swipeFrame.current = requestAnimationFrame(tick);
  };

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => instanceRef.current?.zoomBy(1),
      zoomOut: () => instanceRef.current?.zoomBy(-1),
      showAll: () => instanceRef.current?.fitTo(places, { maxZoom: 15 }),
      focusSelected: () => {
        const place = places.find((p) => p.id === selectedId);
        if (place) instanceRef.current?.focus(place, { minZoom: 14.5 });
      },
      locate: (position) => instanceRef.current?.focus(position, { minZoom: 15 }),
      swipeCamera,
      settleSwipeCamera,
    }),
  );

  return (
    <div
      className={cn("bg-map", className)}
      style={
        {
          "--pin-ring": palette.ring.light,
          "--pin-ring-dark": palette.ring.dark,
          "--pin-caption": palette.caption.light,
          "--pin-caption-dark": palette.caption.dark,
          "--pin-halo": palette.halo.light,
          "--pin-halo-dark": palette.halo.dark,
        } as React.CSSProperties
      }
    >
      <div ref={containerRef} className="h-full w-full" />

      {status === "ready" &&
        places.map((place) =>
          createPortal(
            <MapPin
              place={place}
              color={palette.categories[place.category]}
              selected={place.id === selectedId}
              highlighted={place.id === highlightedId}
              display={layout.get(place.id) ?? "hidden"}
              onSelect={selectPin}
              onHighlight={highlightPin}
            />,
            pinElement(place.id),
            place.id,
          ),
        )}

      {status === "loading" && (
        // Centered in the map left uncovered, so a deep-linked sheet doesn't hide it.
        <div
          className="pointer-events-none absolute flex items-center justify-center"
          style={{ top: padding.top, right: padding.right, bottom: padding.bottom, left: padding.left }}
        >
          <span className="glass glass-luminous flex h-11 animate-pulse items-center rounded-full px-5 text-sm font-medium">
            Loading the map…
          </span>
        </div>
      )}

      {status === "error" && (
        <div className="glass glass-thick absolute inset-x-4 top-1/3 mx-auto flex max-w-sm flex-col items-center rounded-2xl p-8 text-center lg:left-[448px]">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <MapIcon size={22} />
          </span>
          <p className="mt-5 text-lg font-semibold">The map couldn’t load</p>
          <p className="mt-1 text-base text-muted-foreground">
            Every place is still in the list, and each one opens in Apple Maps or Google Maps.
          </p>
        </div>
      )}
    </div>
  );
}
