"use client";

import { Crosshair, Minus, Plus } from "react-feather";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { site } from "@/config/site";
import { useMediaQuery, useViewportHeight } from "@/hooks/use-media-query";
import { useViewMode } from "@/hooks/use-view-mode";
import type { MapPadding } from "@/lib/map";
import { Button } from "@/components/ui/button";
import {
  EMPTY_FILTERS,
  filterPlaces,
  hasActiveFilters,
  matchesInOtherSections,
  neighborhoodCounts,
  pillCounts,
  sortPlaces,
  type PlaceFilters,
} from "@/lib/places/filters";
import { getCategory, getPill } from "@/lib/places/taxonomy";
import { PILL_IDS, type Place } from "@/lib/places/types";
import { cn } from "@/lib/utils";
import { BottomSheet, type SheetSnap } from "./bottom-sheet";
import { FilterBar } from "./filter-bar";
import { MapView, type MapViewHandle } from "./map-view";
import { ModeSwitch, type ViewMode } from "./mode-switch";
import { ListBackdrop } from "./list-backdrop";
import { PlaceActions, PlaceDetail, PlaceSheetHeader, placeColor } from "./place-detail";
import { PlaceList, type NoMatches } from "./place-list";

const RAIL_WIDTH = 400;
const RAIL_INSET = 16;
/** Room kept clear at the bottom for the floating List | Map switch. */
const SWITCH_CLEARANCE = 96;
/** Phone sheet peek: handle, name row, and the action bar (before any home-indicator inset). */
const SHEET_PEEK = 176;

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
        "pressable focus-ring flex size-12 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-hover",
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
    <div className="flex h-11 items-center justify-between gap-4">
      <p aria-live="polite" className="text-sm font-semibold">
        {count} {count === 1 ? "place" : "places"}
      </p>
      {filtersActive && (
        <button
          type="button"
          onClick={onClear}
          className="focus-ring -mx-2 h-11 cursor-pointer rounded-md px-2 text-sm font-semibold underline decoration-1 underline-offset-4 hover:bg-hover"
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
  const [topBarHeight, setTopBarHeight] = useState(148);
  const [safeBottom, setSafeBottom] = useState(0);
  // The list's filter bar turns to glass once cards scroll under it.
  const [barStuck, setBarStuck] = useState(false);
  const listHeaderRef = useRef<HTMLElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const safeBottomRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapViewHandle>(null);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const viewportHeight = useViewportHeight();

  const sorted = useMemo(() => sortPlaces(places), [places]);
  const visible = useMemo(() => filterPlaces(sorted, filters), [sorted, filters]);
  const categories = useMemo(() => new Set(places.map((p) => p.category)), [places]);
  const neighborhoods = useMemo(
    () => neighborhoodCounts(filterPlaces(places, { ...filters, neighborhood: null })),
    [places, filters],
  );
  const counts = useMemo(() => pillCounts(places, filters, PILL_IDS), [places, filters]);
  const elsewhere = useMemo(() => matchesInOtherSections(places, filters), [places, filters]);
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
      // The action bar pads itself above the home indicator; the peek grows to match.
      peek: SHEET_PEEK + Math.max(0, safeBottom - 12),
      mid: Math.max(360, Math.round(viewportHeight * 0.5)),
      full: Math.max(400, viewportHeight - topBarHeight - 8),
    }),
    [viewportHeight, topBarHeight, safeBottom],
  );

  // Framed for map mode even while the list covers it, so switching back is instant.
  const padding = useMemo<MapPadding>(
    () =>
      isDesktop
        ? {
            top: RAIL_INSET,
            right: 80,
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
    const topBar = topBarRef.current;
    const safeArea = safeBottomRef.current;
    if (!topBar || !safeArea) return;
    const observer = new ResizeObserver(() => {
      setTopBarHeight(topBar.offsetHeight);
      setSafeBottom(safeArea.offsetHeight);
    });
    observer.observe(topBar);
    observer.observe(safeArea);
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

  // A section with nothing for the chosen pills points to the matches in other sections.
  let noMatches: NoMatches | undefined;
  if (visible.length === 0 && filters.category && elsewhere > 0) {
    const pillLabels = filters.pills.map((p) => getPill(p).label);
    noMatches = {
      title: `Nothing in ${getCategory(filters.category).plural} matches ${pillLabels.join(" + ")}`,
      body: `But ${elsewhere} ${elsewhere === 1 ? "place" : "places"} in other sections ${elsewhere === 1 ? "does" : "do"}.`,
      actions: (
        <>
          <Button onClick={() => changeFilters({ ...filters, category: null })}>
            Show {elsewhere === 1 ? "it" : `those ${elsewhere}`}
          </Button>
          <Button variant="outline" onClick={() => changeFilters({ ...filters, pills: [] })}>
            {pillLabels.length === 1 ? `Remove ${pillLabels[0]}` : "Remove these filters"}
          </Button>
        </>
      ),
    };
  }

  const listProps = {
    places: visible,
    totalCount: places.length,
    selectedId,
    highlightedId,
    onSelect: select,
    onHighlight: setHighlightedId,
    onClearFilters: clearFilters,
    noMatches,
  };
  const filterProps = {
    filters,
    onChange: changeFilters,
    neighborhoods,
    categories,
    pillCounts: counts,
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-canvas">
      <div
        ref={safeBottomRef}
        aria-hidden
        className="pointer-events-none invisible absolute bottom-0 left-0 h-[env(safe-area-inset-bottom)] w-px"
      />
      <div className="absolute inset-0" inert={listMode}>
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
      </div>

      {/* Map mode, desktop: a solid rail of compact rows, or the open place */}
      <aside
        className={cn(
          "absolute top-4 bottom-4 left-4 z-10 hidden flex-col overflow-hidden rounded-2xl lg:flex",
          selected ? "shadow-raised transition-colors duration-300" : "glass glass-thick",
        )}
        style={{ width: RAIL_WIDTH, backgroundColor: selected ? placeColor(selected) : undefined }}
        aria-label="Places"
        inert={listMode}
      >
        <div className={cn("flex min-h-0 flex-1 flex-col", selected && "hidden")}>
          <header className="shrink-0 border-b border-hairline px-6 pt-6">
            <h1 className="text-lg font-semibold">{site.title}</h1>
            <FilterBar className="-mx-6 mt-2" inset="px-6" {...filterProps} />
            <ResultsSummary
              count={visible.length}
              filtersActive={filtersActive}
              onClear={clearFilters}
            />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-6">
            <PlaceList variant="rows" {...listProps} />
          </div>
        </div>
        {selected && (
          <div
            key={selected.id}
            className="min-h-0 flex-1 overflow-y-auto animate-in fade-in duration-200"
          >
            <PlaceDetail place={selected} onBack={closeDetail} variant="rail" />
          </div>
        )}
      </aside>

      {/* Map mode, desktop: zoom and reset, top right like the map apps */}
      <div className="absolute top-4 right-4 z-10 hidden flex-col gap-3 lg:flex" inert={listMode}>
        <div className="glass flex flex-col overflow-hidden rounded-full">
          <MapButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
            <Plus size={20} />
          </MapButton>
          <span aria-hidden className="mx-3 h-px bg-[var(--glass-edge)]" />
          <MapButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
            <Minus size={20} />
          </MapButton>
        </div>
        <MapButton
          label="Show all places"
          className="glass"
          onClick={() => mapRef.current?.showAll()}
        >
          <Crosshair size={20} />
        </MapButton>
      </div>

      {/* Map mode, phone: filters in a solid bar across the top */}
      <div
        ref={topBarRef}
        className="glass-bar absolute inset-x-0 top-0 z-10 pt-[max(env(safe-area-inset-top),8px)] pb-3 lg:hidden"
        inert={listMode}
      >
        <FilterBar inset="px-4" {...filterProps} />
      </div>

      {/* Map mode, phone: the open place rises in a sheet, name on top and actions pinned below */}
      {!listMode && selected && (
        <div className="lg:hidden">
          <BottomSheet
            tint={placeColor(selected)}
            snap={snap}
            heights={sheetHeights}
            onSnapChange={setSnap}
            scrollKey={`place:${selected.id}`}
            header={
              <PlaceSheetHeader
                place={selected}
                showThumbnail={snap === "peek"}
                onClose={closeDetail}
              />
            }
            footer={<PlaceActions place={selected} />}
          >
            <div className="px-4 pt-4 pb-2">
              <PlaceDetail place={selected} onBack={closeDetail} variant="sheet" />
            </div>
          </BottomSheet>
        </div>
      )}
      {!listMode && !selected && (
        <MapButton
          label="Show all places"
          className="glass absolute right-4 bottom-[calc(max(env(safe-area-inset-bottom),16px)+4px)] z-20 lg:hidden"
          onClick={() => mapRef.current?.showAll()}
        >
          <Crosshair size={20} />
        </MapButton>
      )}

      {/* List mode: the places are the page; the map waits underneath */}
      <section
        aria-label="Places"
        inert={!listMode}
        className={cn("absolute inset-0 z-20 bg-canvas", !listMode && "invisible")}
      >
        <div
          className={cn(
            "absolute inset-0 overflow-y-auto overscroll-contain",
            selected && "invisible",
          )}
          inert={Boolean(selected)}
          onScroll={(event) =>
            setBarStuck(event.currentTarget.scrollTop >= (listHeaderRef.current?.offsetHeight ?? 0))
          }
        >
          <header ref={listHeaderRef} className="relative">
            <ListBackdrop places={places} />
            <div className="relative mx-auto max-w-7xl px-5 pt-[max(env(safe-area-inset-top),28px)] pb-2 lg:px-10 lg:pt-14">
              <h1 className="text-xl font-semibold text-balance lg:text-2xl">{site.title}</h1>
              <p className="mt-2 max-w-2xl text-base text-balance text-ink/80">
                {site.tagline}
              </p>
            </div>
          </header>
          <div
            className={cn(
              "sticky top-0 z-10 border-b border-transparent transition-[background-color,border-color,backdrop-filter] duration-200",
              barStuck && "glass-bar",
            )}
          >
            <div className="mx-auto max-w-7xl pt-2 pb-3 lg:px-9">
              <FilterBar inset="px-5 lg:px-1" {...filterProps} />
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-5 pt-4 pb-36 lg:px-10 lg:pt-6">
            <ResultsSummary
              count={visible.length}
              filtersActive={filtersActive}
              onClear={clearFilters}
            />
            <div className="mt-2">
              <PlaceList
                gridClassName="grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-[repeat(auto-fill,minmax(224px,1fr))] lg:gap-x-6 lg:gap-y-10"
                {...listProps}
              />
            </div>
          </div>
        </div>
        {listMode && selected && (
          <div
            key={selected.id}
            className="absolute inset-0 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
            style={{ backgroundColor: placeColor(selected) }}
          >
            <PlaceDetail
              place={selected}
              onBack={closeDetail}
              onShowOnMap={() => changeMode("map")}
              variant="page"
            />
          </div>
        )}
      </section>

      {/* One switch, same spot in both modes: bottom center (of the map, beside the rail), in thumb reach */}
      {(isDesktop || !selected) && (
        <ModeSwitch
          value={mode}
          onChange={changeMode}
          className={cn(
            "absolute bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 z-30 -translate-x-1/2 lg:bottom-6",
            !listMode && "lg:left-[calc(50%+216px)]",
          )}
        />
      )}
    </main>
  );
}
