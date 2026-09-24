"use client";

import { LocateFixed, Minus, Plus } from "lucide-react";
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
        "flex size-11 cursor-pointer items-center justify-center bg-white/95 text-foreground/80 backdrop-blur transition-colors hover:bg-white hover:text-foreground active:bg-secondary [&_svg]:size-[18px]",
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
    <div className="flex h-11 items-center justify-between">
      <p className="text-[15px] font-semibold" aria-live="polite">
        {count} {count === 1 ? "place" : "places"}
        {filtersActive && <span className="font-normal text-muted-foreground"> match</span>}
      </p>
      {filtersActive && (
        <button
          type="button"
          onClick={onClear}
          className="-mr-2 h-9 cursor-pointer rounded-full px-3 text-[14px] font-medium text-[#2F6FD0] hover:bg-[#2F6FD0]/8"
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
  const [topBarHeight, setTopBarHeight] = useState(148);
  const topBarRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapViewHandle>(null);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const viewportHeight = useViewportHeight();

  const sorted = useMemo(() => sortPlaces(places), [places]);
  const visible = useMemo(() => filterPlaces(sorted, filters), [sorted, filters]);
  const neighborhoods = useMemo(() => neighborhoodCounts(places), [places]);
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const filtersActive = hasActiveFilters(filters);

  // A deep-linked place stays on the map even if the filters would hide it.
  const mapPlaces = useMemo(
    () => (selected && !visible.includes(selected) ? [...visible, selected] : visible),
    [visible, selected],
  );

  const sheetHeights = useMemo(
    () => ({
      peek: 148,
      mid: Math.max(320, Math.round(viewportHeight * 0.46)),
      full: Math.max(360, viewportHeight - topBarHeight - 8),
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
      <h1 className="sr-only">
        {site.title}: {site.tagline}
      </h1>

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
        className="absolute top-4 bottom-4 left-4 z-10 hidden flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/[0.94] shadow-panel backdrop-blur-xl lg:flex"
        style={{ width: PANEL_WIDTH }}
        aria-label="Places"
      >
        <div className={cn("flex min-h-0 flex-1 flex-col", selected && "hidden")}>
          <header className="px-6 pt-6 pb-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {site.name} · Wedding week
            </p>
            <h2 className="mt-2 font-serif text-[38px] leading-none tracking-[-0.01em]">
              {site.title}
            </h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{site.tagline}</p>
          </header>
          <div className="px-6 pb-4">
            <FilterBar
              layout="wrap"
              filters={filters}
              onChange={changeFilters}
              neighborhoods={neighborhoods}
            />
          </div>
          <div className="border-t border-black/[0.06] px-6">
            <ResultsSummary count={visible.length} filtersActive={filtersActive} onClear={clearFilters} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{list}</div>
        </div>
        {selected && (
          <div
            key={selected.id}
            className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6 animate-in fade-in slide-in-from-left-2 duration-200"
          >
            <PlaceDetail place={selected} onBack={closeDetail} />
          </div>
        )}
      </aside>

      {/* Desktop: map controls */}
      <div className="absolute right-4 bottom-8 z-10 hidden flex-col gap-2 lg:flex">
        <div className="flex flex-col divide-y divide-black/[0.06] overflow-hidden rounded-2xl shadow-float">
          <MapButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
            <Plus />
          </MapButton>
          <MapButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
            <Minus />
          </MapButton>
        </div>
        <MapButton
          label="Show all places"
          className="rounded-2xl shadow-float"
          onClick={() => mapRef.current?.showAll()}
        >
          <LocateFixed />
        </MapButton>
      </div>

      {/* Phone: title and filters float over the map */}
      <div
        ref={topBarRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2 pt-[max(env(safe-area-inset-top),10px)] pb-2 lg:hidden"
      >
        <div className="pointer-events-auto mx-3 rounded-2xl bg-white/[0.94] px-4 py-2.5 shadow-float backdrop-blur-xl">
          <p className="font-serif text-[22px] leading-tight">{site.title}</p>
          <p className="text-[12px] text-muted-foreground">
            {site.name} · Wedding-week guide
          </p>
        </div>
        <FilterBar
          layout="scroll"
          filters={filters}
          onChange={changeFilters}
          neighborhoods={neighborhoods}
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
            <MapButton
              label="Show all places"
              className="rounded-full shadow-float"
              onClick={() => mapRef.current?.showAll()}
            >
              <LocateFixed />
            </MapButton>
          }
          header={
            <div className="px-5 pb-1">
              {selected ? (
                <PlaceDetailBackRow onBack={closeDetail} />
              ) : (
                <ResultsSummary
                  count={visible.length}
                  filtersActive={filtersActive}
                  onClear={clearFilters}
                />
              )}
            </div>
          }
        >
          <div className={cn("px-2 pb-6", selected && "hidden")}>{list}</div>
          {selected && (
            <div className="px-5 pt-1 pb-8">
              <PlaceDetail key={selected.id} place={selected} onBack={closeDetail} showBackRow={false} />
            </div>
          )}
        </BottomSheet>
      </div>
    </main>
  );
}
