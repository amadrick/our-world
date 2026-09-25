"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapIcon } from "react-feather";
import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DEFAULT_VIEW, getMapProvider, type MapInstance, type MapPadding } from "@/lib/map";
import {
  densityForZoom,
  estimateLabelWidth,
  layoutPins,
  type PinDisplay,
} from "@/lib/map/pin-layout";
import type { Place } from "@/lib/places/types";
import { cn } from "@/lib/utils";
import { MapPin } from "./map-pin";
import { placeColor } from "./place-detail";

export interface MapViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  showAll: () => void;
  /** Centers the selected place, e.g. after the map comes back into view. */
  focusSelected: () => void;
}

interface MapViewProps {
  ref?: React.Ref<MapViewHandle>;
  places: Place[];
  selectedId: string | null;
  highlightedId: string | null;
  padding: MapPadding;
  /** Changes whenever the filtered set changes, so the map re-frames the results. */
  fitKey: string;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
  onBackgroundClick: () => void;
  className?: string;
}

type Status = "loading" | "ready" | "error";

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
  onSelect,
  onHighlight,
  onBackgroundClick,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MapInstance | null>(null);
  const addedRef = useRef(new Set<string>());
  const framedRef = useRef(false);
  const [status, setStatus] = useState<Status>("loading");
  const [layout, setLayout] = useState<Layout>(() => new Map());
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

  const handleBackgroundClick = useEffectEvent(() => onBackgroundClick());

  // Pins say more as you zoom in (dots, photos, names), stepping down wherever they'd pile up.
  const relayout = useEffectEvent(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const next = layoutPins(
      places.map((place) => ({
        id: place.id,
        ...instance.project(place),
        labelWidth: estimateLabelWidth(place.name),
        forced: place.id === selectedId || place.id === highlightedId,
        preferred: place.andyFavorite === true,
      })),
      instance.size(),
      densityForZoom(instance.zoom()),
    );
    setLayout((current) => (sameLayout(current, next) ? current : next));
  });
  const scheduleLayout = useEffectEvent(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      relayout();
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
            setStatus("ready");
            scheduleLayout();
          },
          onError: (error) => {
            console.error("Map failed to load:", error);
            setStatus("error");
          },
          onBackgroundClick: () => handleBackgroundClick(),
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
  }, [places, selectedId, highlightedId, status]);

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

  const focusSelected = useEffectEvent(() => {
    const place = places.find((p) => p.id === selectedId);
    if (place) instanceRef.current?.focus(place, { minZoom: 14.5 });
  });

  useEffect(() => {
    if (status === "ready" && selectedId) focusSelected();
  }, [selectedId, status]);

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
    }),
    [places, selectedId],
  );

  return (
    <div className={cn("bg-map", className)}>
      <div ref={containerRef} className="h-full w-full" />

      {status === "ready" &&
        places.map((place) =>
          createPortal(
            <MapPin
              place={place}
              selected={place.id === selectedId}
              highlighted={place.id === highlightedId}
              display={layout.get(place.id) ?? "dot"}
              onSelect={() => onSelect(place.id)}
              onHover={(hovering) => onHighlight(hovering ? place.id : null)}
            />,
            pinElement(place.id),
            place.id,
          ),
        )}

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 animate-pulse items-center rounded-full bg-surface px-5 text-sm font-medium text-muted-foreground shadow-float">
            Loading the map…
          </span>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-x-4 top-1/3 mx-auto flex max-w-sm flex-col items-center rounded-2xl bg-surface p-8 text-center shadow-raised lg:left-[448px]">
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
