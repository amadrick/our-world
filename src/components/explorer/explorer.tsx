"use client";

import { Crosshair, Minus, Plus } from "react-feather";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { site } from "@/config/site";
import { useMediaQuery, useViewportHeight } from "@/hooks/use-media-query";
import type { MapPadding } from "@/lib/map";
import {
  EMPTY_FILTERS,
  filterPlaces,
  hasActiveFilters,
  neighborhoodCounts,
  sortPlaces,
  type PlaceFilters,
} from "@/lib/places/filters";
import type { Place } from "@/lib/places/types";
import { cn } from "@/lib/utils";
import { BottomSheet, type SheetSnap } from "./bottom-sheet";
import { FilterBar } from "./filter-bar";
import { MapView, type MapViewHandle } from "./map-view";
import { PlaceDetail, PlaceDetailBackRow } from "./place-detail";
import { PlaceList } from "./place-list";

const PANEL_WIDTH = 400;
const PANEL_INSET = 16;

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full hairline border-black/10 bg-white shadow-float transition-colors hover:bg-secondary"
    >
      {children}
    </button>
  );
}

function ResultsSummary({
  count,
  filtersActive,
  onClear,
}: {
  count: number;
  filtersActive: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex h-10 items-center justify-between text-sm text-muted-foreground">
      <p aria-live="polite">
        {count} {count === 1 ? "place" : "places"}
      </p>
      {filtersActive && (
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer text-foreground underline decoration-black/25 underline-offset-4 hover:decoration-black"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

interface ExplorerProps {
  places: Place[];
  initialPlaceId?: string | null;
}

export function Explorer({ places, initialPlaceId = null }: ExplorerProps) {
  const [filters, setFilters] = useState<PlaceFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPlaceId && places.some((p) => p.id === initialPlaceId) ? initialPlaceId : null,
  );
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("mid");
  const [topBarHeight, setTopBarHeight] = useState(112);
  const topBarRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapViewHandle>(null);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const viewportHeight = useViewportHeight();

  const sorted = useMemo(() => sortPlaces(places), [places]);
  const visible = useMemo(() => filterPlaces(sorted, filters), [sorted, filters]);
  const neighborhoods = useMemo(() => neighborhoodCounts(places), [places]);
  const available = useMemo(
    () => ({
      categories: new Set(places.map((p) => p.category)),
      tags: new Set(places.flatMap((p) => p.tags)),
    }),
    [places],
  );
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const filtersActive = hasActiveFilters(filters);

  // A deep-linked place stays on the map even if the filters would hide it.
  const mapPlaces = useMemo(
    () => (selected && !visible.includes(selected) ? [...visible, selected] : visible),
    [visible, selected],
  );

  const sheetHeights = useMemo(
    () => ({
      peek: 136,
      mid: Math.max(320, Math.round(viewportHeight * 0.48)),
      full: Math.max(360, viewportHeight - topBarHeight - 4),
    }),
    [viewportHeight, topBarHeight],
  );

  const padding = useMemo<MapPadding>(
    () =>
      isDesktop
        ? { top: PANEL_INSET, right: 72, bottom: PANEL_INSET, left: PANEL_INSET * 2 + PANEL_WIDTH }
        : { top: topBarHeight, right: 0, bottom: sheetHeights[snap], left: 0 },
    [isDesktop, topBarHeight, sheetHeights, snap],
  );

  useEffect(() => {
    const element = topBarRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setTopBarHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("place", selectedId);
    else url.searchParams.delete("place");
    window.history.replaceState(null, "", url);
  }, [selectedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setSnap("mid");
  }, []);

  const changeFilters = (next: PlaceFilters) => {
    setFilters(next);
    setSelectedId(null);
  };
  const clearFilters = () => changeFilters(EMPTY_FILTERS);
  const closeDetail = () => setSelectedId(null);

  const list = (
    <PlaceList
      places={visible}
      totalCount={places.length}
      selectedId={selectedId}
      highlightedId={highlightedId}
      onSelect={select}
      onHighlight={setHighlightedId}
      onClearFilters={clearFilters}
    />
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-map">
      <MapView
        ref={mapRef}
        className="absolute inset-0"
        places={mapPlaces}
        selectedId={selectedId}
        highlightedId={highlightedId}
        padding={padding}
        fitKey={JSON.stringify(filters)}
        onSelect={select}
        onHighlight={setHighlightedId}
        onBackgroundClick={closeDetail}
      />

      {/* Desktop: floating side panel */}
      <aside
        className="absolute top-4 bottom-4 left-4 z-10 hidden flex-col overflow-hidden rounded-[32px] hairline border-black/10 bg-white shadow-panel lg:flex"
        style={{ width: PANEL_WIDTH }}
        aria-label="Places"
      >
        <div className={cn("min-h-0 flex-1 overflow-y-auto", selected && "hidden")}>
          <header className="px-6 pt-7 pb-6">
            <h1 className="text-xl font-medium">{site.title}</h1>
            <p className="mt-2 text-base text-muted-foreground">{site.tagline}</p>
          </header>
          <div className="px-6 pb-4">
            <FilterBar
              layout="wrap"
              filters={filters}
              onChange={changeFilters}
              neighborhoods={neighborhoods}
              available={available}
            />
          </div>
          <div className="sticky top-0 z-10 bg-white px-6">
            <ResultsSummary count={visible.length} filtersActive={filtersActive} onClear={clearFilters} />
          </div>
          <div className="px-3 pb-3">{list}</div>
        </div>
        {selected && (
          <div
            key={selected.id}
            className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-6 animate-in fade-in duration-200"
          >
            <PlaceDetail place={selected} onBack={closeDetail} />
          </div>
        )}
      </aside>

      {/* Desktop: map controls */}
      <div className="absolute right-4 bottom-8 z-10 hidden flex-col gap-2 lg:flex">
        <MapButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus size={18} />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus size={18} />
        </MapButton>
        <MapButton label="Show all places" onClick={() => mapRef.current?.showAll()}>
          <Crosshair size={18} />
        </MapButton>
      </div>

      {/* Phone: filters float over the map */}
      <div
        ref={topBarRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-[max(env(safe-area-inset-top),6px)] lg:hidden"
      >
        <FilterBar
          layout="scroll"
          filters={filters}
          onChange={changeFilters}
          neighborhoods={neighborhoods}
          available={available}
        />
      </div>

      {/* Phone: draggable sheet with the list or the selected place */}
      <div className="lg:hidden">
        <BottomSheet
          snap={snap}
          heights={sheetHeights}
          onSnapChange={setSnap}
          scrollKey={selected ? `place:${selected.id}` : "list"}
          accessory={
            <MapButton label="Show all places" onClick={() => mapRef.current?.showAll()}>
              <Crosshair size={18} />
            </MapButton>
          }
          header={
            <div className="px-5 pb-1">
              {selected ? (
                <PlaceDetailBackRow onBack={closeDetail} />
              ) : (
                <>
                  <h1 className="pt-1 text-lg font-medium">{site.title}</h1>
                  <ResultsSummary
                    count={visible.length}
                    filtersActive={filtersActive}
                    onClear={clearFilters}
                  />
                </>
              )}
            </div>
          }
        >
          <div className={cn("px-2 pb-6", selected && "hidden")}>{list}</div>
          {selected && (
            <div className="px-5 pt-1 pb-8">
              <PlaceDetail place={selected} onBack={closeDetail} showBackRow={false} />
            </div>
          )}
        </BottomSheet>
      </div>
    </main>
  );
}
