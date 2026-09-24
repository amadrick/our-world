"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { MapPinOff } from "lucide-react";
import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DEFAULT_VIEW, getMapProvider, type MapInstance, type MapPadding } from "@/lib/map";
import type { Place } from "@/lib/places/types";
import { cn } from "@/lib/utils";
import { MapPin } from "./map-pin";

export interface MapViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  showAll: () => void;
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
          },
          onError: (error) => {
            console.error("Map failed to load:", error);
            setStatus("error");
          },
          onBackgroundClick: () => handleBackgroundClick(),
        });
      })
      .catch((error) => {
        console.error("Map library failed to load:", error);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
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
    instanceRef.current?.setPadding(padding);
  }, [padding, status]);

  const frame = useEffectEvent((animate: boolean) => {
    instanceRef.current?.fitTo(places, { animate, maxZoom: 15 });
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
    }),
    [places],
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
              onSelect={() => onSelect(place.id)}
              onHover={(hovering) => onHighlight(hovering ? place.id : null)}
            />,
            pinElement(place.id),
            place.id,
          ),
        )}

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0 animate-pulse bg-[radial-gradient(ellipse_at_center,#ebe8e2_0%,transparent_70%)]" />
          <span className="relative rounded-full bg-white/90 px-4 py-2 text-[13px] font-medium text-muted-foreground shadow-float">
            Loading the map…
          </span>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-x-4 top-1/3 mx-auto flex max-w-sm flex-col items-center rounded-3xl bg-white/95 p-6 text-center shadow-panel lg:left-[440px]">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <MapPinOff className="size-5" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">The map couldn&apos;t load</p>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            Every place is still in the list, and each one opens in Apple Maps or Google Maps.
          </p>
        </div>
      )}
    </div>
  );
}
