"use client";

import { Crosshair, Minus, Plus } from "react-feather";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { site } from "@/config/site";
import { useMediaQuery, useViewportHeight } from "@/hooks/use-media-query";
import { useViewMode } from "@/hooks/use-view-mode";
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
import { ModeSwitch, type ViewMode } from "./mode-switch";
import { PlaceDetail, PlaceDetailBackRow } from "./place-detail";
import { PlaceList } from "./place-list";

const RAIL_WIDTH = 360;
const RAIL_INSET = 16;
/** Room kept clear at the bottom for the floating List | Map switch. */
const SWITCH_CLEARANCE = 88;

function MapButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors",
        className,
      )}
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
  const [mode, setMode] = useViewMode();
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
  const listMode = mode === "list";

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

  // Framed for map mode even while the list covers it, so switching back is instant.
  const padding = useMemo<MapPadding>(
    () =>
      isDesktop
        ? {
            top: RAIL_INSET,
            right: 72,
            bottom: SWITCH_CLEARANCE,
            left: RAIL_INSET * 2 + RAIL_WIDTH,
          }
        : {
            top: topBarHeight,
            right: 0,
            bottom: selected ? sheetHeights[snap] : SWITCH_CLEARANCE,
            left: 0,
          },
    [isDesktop, topBarHeight, sheetHeights, snap, selected],
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

  const changeMode = (next: ViewMode) => {
    setMode(next);
    // Coming back to the map with a place open: show it, centered above its sheet.
    if (next === "map" && selectedId) {
      setSnap("mid");
      requestAnimationFrame(() => mapRef.current?.focusSelected());
    }
  };

  const changeFilters = (next: PlaceFilters) => {
    setFilters(next);
    setSelectedId(null);
  };
  const clearFilters = () => changeFilters(EMPTY_FILTERS);
  const closeDetail = () => setSelectedId(null);

  const listProps = {
    places: visible,
    totalCount: places.length,
    selectedId,
    highlightedId,
    onSelect: select,
    onHighlight: setHighlightedId,
    onClearFilters: clearFilters,
  };
  const filterProps = { filters, onChange: changeFilters, neighborhoods, available };

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

      {/* Map mode, desktop: a slim rail of compact rows, or the open place */}
      <aside
        className="glass absolute top-4 bottom-4 left-4 z-10 hidden flex-col overflow-hidden rounded-[32px] lg:flex"
        style={{ width: RAIL_WIDTH }}
        aria-label="Places"
        inert={listMode}
      >
        <div className={cn("min-h-0 flex-1 overflow-y-auto", selected && "hidden")}>
          <header className="px-6 pt-7 pb-5">
            <h1 className="text-xl font-medium">{site.title}</h1>
          </header>
          <div className="px-6 pb-4">
            <FilterBar layout="wrap" {...filterProps} />
          </div>
          <div className="scroll-edge px-6 pb-2">
            <ResultsSummary count={visible.length} filtersActive={filtersActive} onClear={clearFilters} />
          </div>
          <div className="px-3 pb-24">
            <PlaceList variant="rows" {...listProps} />
          </div>
        </div>
        {selected && (
          <div
            key={selected.id}
            className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-24 animate-in fade-in duration-200"
          >
            <PlaceDetail place={selected} onBack={closeDetail} bodyClassName="px-3" />
          </div>
        )}
      </aside>

      {/* Map mode, desktop: zoom and reset */}
      <div className="absolute right-4 bottom-8 z-10 hidden flex-col gap-3 lg:flex" inert={listMode}>
        <div className="glass glass-refract flex flex-col overflow-hidden rounded-full">
          <MapButton
            label="Zoom in"
            className="hover:bg-white/30 active:bg-white/45"
            onClick={() => mapRef.current?.zoomIn()}
          >
            <Plus size={18} />
          </MapButton>
          <span aria-hidden className="mx-3 h-[0.5px] bg-black/15" />
          <MapButton
            label="Zoom out"
            className="hover:bg-white/30 active:bg-white/45"
            onClick={() => mapRef.current?.zoomOut()}
          >
            <Minus size={18} />
          </MapButton>
        </div>
        <MapButton
          label="Show all places"
          className="glass glass-interactive glass-refract"
          onClick={() => mapRef.current?.showAll()}
        >
          <Crosshair size={18} />
        </MapButton>
      </div>

      {/* Map mode, phone: filters float over a full map */}
      <div
        ref={topBarRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-[max(env(safe-area-inset-top),6px)] lg:hidden"
        inert={listMode}
      >
        <FilterBar layout="scroll" {...filterProps} />
      </div>

      {/* Map mode, phone: the open place slides up in a sheet */}
      {!listMode && selected && (
        <div className="lg:hidden">
          <BottomSheet
            snap={snap}
            heights={sheetHeights}
            onSnapChange={setSnap}
            scrollKey={`place:${selected.id}`}
            header={
              <div className="px-5 pb-1">
                <PlaceDetailBackRow onBack={closeDetail} />
              </div>
            }
          >
            <div className="px-5 pt-1 pb-8">
              <PlaceDetail place={selected} onBack={closeDetail} showBackRow={false} />
            </div>
          </BottomSheet>
        </div>
      )}
      {!listMode && !selected && (
        <MapButton
          label="Show all places"
          className="glass glass-interactive absolute right-4 bottom-[calc(max(env(safe-area-inset-bottom),12px)+14px)] z-20 size-12 lg:hidden"
          onClick={() => mapRef.current?.showAll()}
        >
          <Crosshair size={18} />
        </MapButton>
      )}

      {/* List mode: the places are the page; the map waits underneath */}
      <section
        aria-label="Places"
        inert={!listMode}
        className={cn("absolute inset-0 z-20 bg-map", !listMode && "invisible")}
      >
        <div
          className={cn("absolute inset-0 overflow-y-auto overscroll-contain", selected && "invisible")}
          inert={Boolean(selected)}
        >
          <div className="mx-auto max-w-6xl px-4 pt-[max(env(safe-area-inset-top),20px)] pb-32 lg:px-10 lg:pt-12">
            <header className="px-1 lg:px-0">
              <h1 className="text-xl font-medium">{site.title}</h1>
              <p className="mt-1.5 max-w-xl text-base text-muted-foreground">{site.tagline}</p>
            </header>
            <div className="sticky top-0 z-10 -mx-4 mt-4 lg:static lg:mx-0 lg:mt-6">
              {/* The fade sits beside the pills, not around them: a mask on their ancestor would cut off their blur. */}
              <div className="relative lg:hidden">
                <div aria-hidden className="scroll-edge absolute inset-x-0 top-0 -bottom-3 z-0" />
                <FilterBar layout="scroll" {...filterProps} />
              </div>
              <div className="hidden lg:block">
                <FilterBar layout="wrap" {...filterProps} />
              </div>
            </div>
            <div className="mt-2 px-1 lg:mt-4 lg:px-0">
              <ResultsSummary count={visible.length} filtersActive={filtersActive} onClear={clearFilters} />
            </div>
            <div className="-mx-1.5 mt-1">
              <PlaceList
                gridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] lg:gap-3"
                {...listProps}
              />
            </div>
          </div>
        </div>
        {listMode && selected && (
          <div
            key={selected.id}
            className="absolute inset-0 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
          >
            <div className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),16px)] pb-32 md:max-w-4xl md:px-10 md:pt-12">
              <PlaceDetail place={selected} onBack={closeDetail} layout="split" />
            </div>
          </div>
        )}
      </section>

      {/* One switch, same spot in both modes: bottom center, in thumb reach */}
      {(listMode || isDesktop || !selected) && (
        <ModeSwitch
          value={mode}
          onChange={changeMode}
          className="absolute bottom-[max(env(safe-area-inset-bottom),12px)] left-1/2 z-30 mb-2 -translate-x-1/2 lg:bottom-6"
        />
      )}
    </main>
  );
}
