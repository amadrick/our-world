"use client";

import { Crosshair, Minus, Plus } from "react-feather";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

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
import { placeNeighbors, placeWindow, type StepDirection } from "@/lib/places/swipe";
import { getCategory, getPill } from "@/lib/places/taxonomy";
import { PILL_IDS, type Place } from "@/lib/places/types";
import { decodePlacePhoto, preloadPlacePhoto } from "@/components/places/place-image";
import { cn } from "@/lib/utils";
import { BottomSheet, SHEET_EXIT_MS, type SheetSnap } from "./bottom-sheet";
import { FilterBar } from "./filter-bar";
import { MapView, type MapViewHandle } from "./map-view";
import { ModeSwitch, type ViewMode } from "./mode-switch";
import { ListBackdrop } from "./list-backdrop";
import {
  PHOTO_SIZES,
  PlaceActions,
  PlaceDetail,
  PlaceSheetHeader,
  SheetCloseButton,
  placeColor,
  type Stepper,
} from "./place-detail";
import { PlaceList, type NoMatches } from "./place-list";
import { useSwipeBetween } from "./use-swipe-between";

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
  const [topBarHeight, setTopBarHeight] = useState(72);
  const [safeBottom, setSafeBottom] = useState(0);
  // Once the title has scrolled away, keep the notch clear of the cards. The pills themselves stay bare.
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
  // The phone sheet outlives the selection just long enough to play its exit.
  const [sheetPlace, setSheetPlace] = useState<Place | null>(selected);
  if (selected && selected !== sheetPlace) setSheetPlace(selected);
  const sheetClosing = !selected && sheetPlace !== null;
  const filtersActive = hasActiveFilters(filters);
  const listMode = mode === "list";

  // A deep-linked place stays on the map even if the filters would hide it.
  const mapPlaces = useMemo(
    () => (selected && !visible.includes(selected) ? [...visible, selected] : visible),
    [visible, selected],
  );

  // Swipes, arrow keys, and the chevrons step through the same order as the list.
  const { prev, next } = placeNeighbors(mapPlaces, selectedId);
  const slides = useMemo(
    () => placeWindow(mapPlaces, selectedId ?? sheetPlace?.id ?? null, 2),
    [mapPlaces, selectedId, sheetPlace],
  );
  const [stepping, setStepping] = useState<{ direction: StepDirection; swiped: boolean } | null>(null);

  const sheetHeights = useMemo(() => {
    const belowHeader = Math.max(200, viewportHeight - topBarHeight - 8);
    const peek = SHEET_PEEK + Math.max(0, safeBottom - 12);
    // Half the screen, but never taller than the room under the pills (landscape phones).
    const mid = Math.min(Math.max(Math.round(viewportHeight * 0.5), 240), belowHeader);
    return { peek: Math.min(peek, mid), mid, full: belowHeader };
  }, [viewportHeight, topBarHeight, safeBottom]);

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
    if (!sheetClosing) return;
    const timer = window.setTimeout(() => setSheetPlace(null), SHEET_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [sheetClosing]);

  // The rail keeps one detail view across places (so the photo can crossfade); each place starts at the top.
  const railScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    railScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("place", selectedId);
    else url.searchParams.delete("place");
    window.history.replaceState(null, "", url);
  }, [selectedId]);

  const step = (direction: StepDirection, swiped = false) => {
    const target = direction === 1 ? next : prev;
    if (!target) return;
    setStepping({ direction, swiped });
    setSelectedId(target.id);
  };
  const stepper: Stepper = { prev, next, onStep: (direction) => step(direction) };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") setSelectedId(null);
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (!selectedId || event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    // Arrows keep their meaning in fields, pickers, and on the map itself (where they pan).
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable], [role='listbox'], [role='slider'], .maplibregl-map")) {
      return;
    }
    event.preventDefault();
    step(event.key === "ArrowRight" ? 1 : -1);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const sheetSwipeRef = useRef<HTMLDivElement>(null);
  useSwipeBetween(sheetSwipeRef, {
    enabled: !listMode && !isDesktop && selected !== null,
    hasPrev: prev !== null,
    hasNext: next !== null,
    onStep: (direction) => step(direction, true),
  });
  const pageRef = useRef<HTMLDivElement>(null);
  useSwipeBetween(pageRef, {
    enabled: listMode && !isDesktop && selected !== null,
    hasPrev: prev !== null,
    hasNext: next !== null,
    onStep: (direction) => step(direction, true),
  });
  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  // The neighbors' photos load ahead, in the size this surface shows them, so a step never waits on one.
  const photoSizes = listMode ? PHOTO_SIZES.page : isDesktop ? PHOTO_SIZES.rail : PHOTO_SIZES.sheet;
  useEffect(() => {
    for (const slide of slides) {
      if (slide.offset === 0) continue;
      preloadPlacePhoto(slide.place, photoSizes);
      decodePlacePhoto(slide.place, photoSizes);
    }
  }, [slides, photoSizes]);

  const select = useCallback((id: string) => {
    setStepping(null);
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
          glide={stepping !== null}
        />
      </div>

      {/* Map mode, desktop: a solid rail of compact rows, or the open place */}
      <aside
        className={cn(
          "absolute top-4 bottom-4 left-4 z-10 hidden flex-col overflow-hidden rounded-2xl lg:flex",
          selected ? "shadow-raised transition-colors duration-300" : "glass",
        )}
        style={{ width: RAIL_WIDTH, backgroundColor: selected ? placeColor(selected) : undefined }}
        aria-label="Places"
        inert={listMode}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col animate-in fade-in duration-150",
            selected && "hidden",
          )}
        >
          <header className="shrink-0 px-6 pt-6">
            <h1 className="text-lg font-semibold">{site.title}</h1>
            <FilterBar className="-mx-6 mt-3" inset="px-6" floating={false} {...filterProps} />
            <ResultsSummary
              count={visible.length}
              filtersActive={filtersActive}
              onClear={clearFilters}
            />
          </header>
          <div className="overlay-scroll-y min-h-0 flex-1 px-3 pt-1 pb-6">
            <PlaceList variant="rows" {...listProps} />
          </div>
        </div>
        {selected && (
          <div ref={railScrollRef} className="overlay-scroll-y min-h-0 flex-1">
            <PlaceDetail
              place={selected}
              onBack={closeDetail}
              variant="rail"
              stepper={stepper}
              enterFrom={stepping?.direction}
            />
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

      {/* Map mode, phone: pills float on the map. No bar behind them. */}
      <div
        ref={topBarRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-[max(env(safe-area-inset-top),10px)] pr-[env(safe-area-inset-right)] pb-3 pl-[env(safe-area-inset-left)] lg:hidden"
        inert={listMode}
      >
        <FilterBar className="pointer-events-auto" inset="px-4" {...filterProps} />
      </div>

      {/* Map mode, phone: the open place rises in a sheet, photo on top; peeking, just its name and actions */}
      {!listMode && sheetPlace && (
        <div ref={sheetSwipeRef} className="lg:hidden">
          <BottomSheet
            tint={placeColor(sheetPlace)}
            snap={snap}
            heights={sheetHeights}
            onSnapChange={setSnap}
            scrollKey={`place:${sheetPlace.id}`}
            overlay={snap !== "peek"}
            closing={sheetClosing}
            onDismiss={closeDetail}
            header={
              snap === "peek" ? (
                <PlaceSheetHeader place={sheetPlace} onClose={closeDetail} slides={slides} />
              ) : (
                <SheetCloseButton onClose={closeDetail} />
              )
            }
            footer={snap === "peek" ? <PlaceActions place={sheetPlace} /> : undefined}
          >
            <PlaceDetail
              place={sheetPlace}
              onBack={closeDetail}
              variant="sheet"
              enterFrom={stepping?.direction}
              swiped={stepping?.swiped}
              slides={slides}
            />
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
        className={cn(
          "absolute inset-0 z-20",
          !listMode && "invisible",
          !(listMode && selected) && "bg-canvas",
        )}
        style={listMode && selected ? { backgroundColor: placeColor(selected) } : undefined}
      >
        <div
          className={cn(
            "overlay-scroll-y absolute inset-0",
            selected && "invisible",
          )}
          inert={Boolean(selected)}
          onScroll={(event) =>
            setBarStuck(event.currentTarget.scrollTop >= (listHeaderRef.current?.offsetHeight ?? 0) - 1)
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
          <div className="sticky top-0 z-10">
            {barStuck && (
              <div aria-hidden className="h-[env(safe-area-inset-top)] bg-canvas" />
            )}
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
            ref={pageRef}
            className="overlay-scroll-y absolute inset-0 touch-pan-y [transition:background-color_var(--open-tint)_var(--ease-out-soft)] animate-in duration-200 fade-in"
            style={{ backgroundColor: placeColor(selected) }}
          >
            <PlaceDetail
              place={selected}
              onBack={closeDetail}
              onShowOnMap={() => changeMode("map")}
              variant="page"
              stepper={stepper}
              enterFrom={stepping?.direction}
              swiped={stepping?.swiped}
              slides={isDesktop ? undefined : slides}
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
