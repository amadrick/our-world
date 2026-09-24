"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";

import { getMapProvider, type MapInstance } from "@/lib/map";
import { cn } from "@/lib/utils";

interface LocationPreviewProps {
  lat: number;
  lng: number;
  color: string;
  className?: string;
}

/** A small map so the admin can confirm the pin landed in the right spot. */
export function LocationPreview({ lat, lng, color, className }: LocationPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let instance: MapInstance | null = null;

    getMapProvider()
      .load()
      .then((create) => {
        if (cancelled || !containerRef.current) return;
        instance = create({
          container: containerRef.current,
          center: { lat, lng },
          zoom: 15.5,
          onReady: () => setStatus("ready"),
          onError: () => setStatus("error"),
        });
        const dot = document.createElement("div");
        dot.className =
          "size-5 translate-y-2.5 rounded-full border-[3px] border-white shadow-[0_1px_5px_rgb(0_0_0/0.35)]";
        dot.style.backgroundColor = color;
        instance.addMarker("preview", { lat, lng }, dot);
      })
      .catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [lat, lng, color]);

  return (
    <div className={cn("relative overflow-hidden bg-map", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-black/[0.03]" />}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-foreground">
          Map preview unavailable
        </div>
      )}
    </div>
  );
}
