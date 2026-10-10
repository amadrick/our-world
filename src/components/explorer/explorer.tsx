"use client";

import { Maximize, Minus, Navigation, Plus, X } from "react-feather";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";

import { site } from "@/config/site";
import { useClocks } from "@/hooks/use-clock";
import { useDriveTimes } from "@/hooks/use-drive-times";
import { estimateTravel, trafficPeriod } from "@/lib/geo/travel-estimate";
import { RUBBER_CAMERA } from "@/lib/map/swipe-camera";
import { useMediaQuery, useViewportHeight } from "@/hooks/use-media-query";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { locationMessage, useUserLocation, type LocationStatus } from "@/hooks/use-user-location";
import { pruneSaved, useSavedIds } from "@/hooks/use-saved-places";
import { useSortMode } from "@/hooks/use-sort-mode";
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
  type PlaceFilters,
} from "@/lib/places/filters";
import { buildSearchIndex, hitTier, normalize, searchPlaces } from "@/lib/places/search";
import { SECTION_TITLES, groupBySection, orderPlaces, type SortMode } from "@/lib/places/smart-order";
import { placeNeighbors, placeWindow, type StepDirection } from "@/lib/places/swipe";
import { getCategory, getPill } from "@/lib/places/taxonomy";
import { PILL_IDS, type Place } from "@/lib/places/types";
import { decodePlacePhoto, preloadPlacePhoto } from "@/components/places/place-image";
import { cn } from "@/lib/utils";
import { BottomSheet, SHEET_EXIT_MS, type SheetSnap } from "./bottom-sheet";
import { FilterBar, type SearchControls } from "./filter-bar";
import { MapView, type MapViewHandle } from "./map-view";
import { ModeSwitch, type ViewMode } from "./mode-switch";
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
import { SortControl } from "./sort-control";
import { useSwipeBetween } from "./use-swipe-between";

const RAIL_WIDTH = 400;
const RAIL_INSET = 16;
/** Room kept clear at the bottom for the floating List | Map switch. */
const SWITCH_CLEARANCE = 96;
/** Phone sheet peek: handle, name row, and the action bar (before any home-indicator inset). */
const SHEET_PEEK = 176;
/** Room under the map buttons at the bottom of the half sheet. */
const SHEET_FOLD_GAP = 20;

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
        "pressable focus-ring flex size-12 items-center justify-center rounded-full text-ink hover:bg-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}

function LocateButton({
  status,
  onClick,
  className,
}: {
  status: LocationStatus;
  onClick: () => void;
  className?: string;
}) {
  const on = status === "on";
  return (
    <MapButton label={on ? "Center on your location" : "Show your location"} onClick={onClick} className={className}>
      <Navigation
        size={19}
        fill={on ? "currentColor" : "none"}
        className={cn(on && "text-[#007aff] dark:text-[#0a84ff]", status === "locating" && "animate-pulse")}
      />
    </MapButton>
  );
}

/** A small glass note under the pills when the location can't be shown. */
function LocationNotice({ message, onDismiss, top }: { message: string; onDismiss: () => void; top: number }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);
  return (
    <div
      role="status"
      className="glass absolute inset-x-4 z-30 mx-auto flex max-w-sm items-center gap-3 rounded-2xl py-2.5 pr-2 pl-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 lg:right-24 lg:left-auto lg:mx-0"
      style={{ top }}
    >
      <Navigation size={16} className="shrink-0 opacity-70" aria-hidden />
      <p className="min-w-0 flex-1 text-pretty">{message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="pressable focus-ring flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-hover"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

/** The map data's credit, kept off the map: at the end of the list and the desktop rail. */
function MapCredit({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground/80", className)}>
      Map data ©{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        OpenStreetMap
      </a>{" "}
      contributors ·{" "}
      <a href="https://protomaps.com" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        Protomaps
      </a>
    </p>
  );
}

function ResultsSummary({
  count,
  filtersActive,
  onClear,
  sort,
  onSort,
}: {
  count: number;
  filtersActive: boolean;
  onClear: () => void;
  sort: SortMode;
  onSort: (mode: SortMode) => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <p aria-live="polite" className="shrink-0 text-sm font-semibold">
          {count} {count === 1 ? "place" : "places"}
        </p>
        {filtersActive && (
          <button
            type="button"
            onClick={onClear}
            className="focus-ring -mx-1 h-11 truncate rounded-md px-1 text-sm font-semibold underline decoration-1 underline-offset-4 hover:bg-hover"
          >
            Clear filters
          </button>
        )}
      </div>
      <SortControl value={sort} onChange={onSort} />
    </div>
  );
}

interface ExplorerProps {
  places: Place[];
  initialPlaceId?: string | null;
  /** A search carried in the link (?q=). */
  initialQuery?: string;
  /** When the server rendered the page, so hours and order hydrate the same. */
  renderedAt: string;
}

/** Fewer than two letters is still typing: everything stays listed. */
const isSearching = (query: string) => normalize(query).replace(/ /g, "").length >= 2;
/** The map waits for a pause in typing before it re-frames. */
const FIT_AFTER_TYPING_MS = 350;

export function Explorer({ places, initialPlaceId = null, initialQuery = "", renderedAt }: ExplorerProps) {
  const [mode, setMode] = useViewMode();
  const [filters, setFilters] = useState<PlaceFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState(initialQuery);
  const [searchOpen, setSearchOpen] = useState(initialQuery !== "");
  const [settledQuery, setSettledQuery] = useState(initialQuery);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledQuery(query), FIT_AFTER_TYPING_MS);
    return () => window.clearTimeout(timer);
  }, [query]);
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
  const listScrollRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const safeBottomRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapViewHandle>(null);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const viewportHeight = useViewportHeight();
  const here = useUserLocation();
  const drive = useDriveTimes(here.position);
  const [sortMode, setSortMode] = useSortMode();
  // The order holds while the reader is into the list or has a place open, so nothing moves under a finger.
  const clocks = useClocks(
    renderedAt,
    () => selectedId !== null || (mode === "list" && (listScrollRef.current?.scrollTop ?? 0) > 8),
  );
  // Proximity from where the reader is, to about a kilometer, so GPS drift doesn't reshuffle the list.
  const originLat = here.position ? Math.round(here.position.lat * 100) / 100 : null;
  const originLng = here.position ? Math.round(here.position.lng * 100) / 100 : null;
  const origin = useMemo(
    () => (originLat === null || originLng === null ? null : { lat: originLat, lng: originLng }),
    [originLat, originLng],
  );
  const savedIds = useSavedIds();
  useEffect(() => {
    if (savedIds.size > 0) pruneSaved(new Set(places.map((p) => p.id)));
  }, [places, savedIds]);
  const searchIndex = useMemo(() => buildSearchIndex(places), [places]);
  const searching = isSearching(query);
  const hits = useMemo(
    () => (searching ? new Map(searchPlaces(searchIndex, query).map((hit) => [hit.id, hit])) : null),
    [searchIndex, query, searching],
  );
  // Everything below (the list, the map, every pill's count) works on what the search left.
  const searched = useMemo(() => (hits ? places.filter((p) => hits.has(p.id)) : places), [places, hits]);
  const ranked = useMemo(() => {
    const ordered = orderPlaces(filterPlaces(searched, filters, clocks.orderNow, savedIds), sortMode, {
      now: clocks.orderNow,
      origin,
    });
    // The best text matches first (name, then what it is, then where, then the description), each in the chosen order.
    if (!hits) return ordered;
    const tier = (id: string) => hitTier(hits.get(id)!);
    return ordered.sort((a, b) => tier(a.place.id) - tier(b.place.id));
  }, [searched, hits, filters, sortMode, clocks.orderNow, origin, savedIds]);
  const visible = useMemo(() => ranked.map((r) => r.place), [ranked]);
  // The router's free-flow times, scaled for the hour's traffic (or a walk, if it's close).
  const period = trafficPeriod(clocks.now);
  const travel = useMemo(
    () =>
      drive.seconds
        ? Object.fromEntries(
            Object.entries(drive.seconds).map(([id, s]) => [id, estimateTravel(s, drive.meters?.[id], period)]),
          )
        : null,
    [drive.seconds, drive.meters, period],
  );
  const sections = useMemo(
    () =>
      sortMode === "near" && !hits
        ? groupBySection(ranked).map((g) => ({ id: g.id, title: SECTION_TITLES[g.id], places: g.items.map((r) => r.place) }))
        : undefined,
    [ranked, sortMode, hits],
  );
  const categories = useMemo(() => new Set(places.map((p) => p.category)), [places]);
  const neighborhoods = useMemo(
    () => neighborhoodCounts(filterPlaces(searched, { ...filters, neighborhood: null }, clocks.orderNow, savedIds)),
    [searched, filters, clocks.orderNow, savedIds],
  );
  const counts = useMemo(
    () => pillCounts(searched, filters, PILL_IDS, clocks.orderNow, savedIds),
    [searched, filters, clocks.orderNow, savedIds],
  );
  const openNowCount = useMemo(
    () => filterPlaces(searched, { ...filters, openNow: true }, clocks.orderNow, savedIds).length,
    [searched, filters, clocks.orderNow, savedIds],
  );
  const savedCount = useMemo(
    () => filterPlaces(searched, { ...filters, saved: true }, clocks.orderNow, savedIds).length,
    [searched, filters, clocks.orderNow, savedIds],
  );
  const elsewhere = useMemo(
    () => matchesInOtherSections(searched, filters, clocks.orderNow, savedIds),
    [searched, filters, clocks.orderNow, savedIds],
  );
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

  // How far down the sheet the open place's map buttons end, measured once it renders.
  const [sheetFold, setSheetFold] = useState<number | null>(null);
  const sheetHeights = useMemo(() => {
    const height = viewportHeight ?? 800;
    // The sheet floats 8 px off the bottom edge, and 8 px under the pills at full height.
    const belowHeader = Math.max(200, height - topBarHeight - 16);
    const peek = SHEET_PEEK + Math.max(0, safeBottom - 12);
    // The half sheet ends just under the map buttons, whatever the screen height, but never
    // grows taller than the room under the pills (landscape phones).
    const fitted = sheetFold === null ? Math.max(Math.round(height * 0.5), 240) : sheetFold + SHEET_FOLD_GAP;
    const mid = Math.min(fitted, belowHeader);
    return { peek: Math.min(peek, mid), mid, full: belowHeader };
  }, [viewportHeight, topBarHeight, safeBottom, sheetFold]);

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
  const railListRef = useRef<HTMLDivElement>(null);
  useScrollFade(railListRef);
  useScrollFade(railScrollRef, Boolean(selected));

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("place", selectedId);
    else url.searchParams.delete("place");
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }, [selectedId, query]);

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

  // A neighbor can be swiped to only once its page is complete: every picture on it decoded
  // (not just requested) and, with a location, its drive time in. Until then the swipe rubber-bands.
  const [decoded, setDecoded] = useState<Readonly<Record<string, true>>>({});
  const drivesSettled = !here.position || !drive.pending;
  const prevReady = prev !== null && decoded[prev.id] === true && drivesSettled;
  const nextReady = next !== null && decoded[next.id] === true && drivesSettled;

  const sheetSwipeRef = useRef<HTMLDivElement>(null);
  useSwipeBetween(sheetSwipeRef, {
    enabled: !listMode && !isDesktop && selected !== null,
    hasPrev: prevReady,
    hasNext: nextReady,
    onStep: (direction) => step(direction, true),
    // The map pans with the card at the current zoom; past a place that isn't ready it only leans.
    onDrag: (direction, p, open) => {
      const target = direction === 1 ? next : prev;
      mapRef.current?.swipeCamera(target?.id ?? null, open ? p : p * RUBBER_CAMERA, open);
    },
    onRelease: (_direction, to, durationMs) => mapRef.current?.settleSwipeCamera(to, durationMs),
  });
  useLayoutEffect(() => {
    const fold = sheetSwipeRef.current?.querySelector<HTMLElement>("[data-sheet-fold]");
    if (!fold) return;
    // offsetTop ignores the sheet's slide and the items' entrance transforms, so this is the resting layout.
    const measure = () => {
      let bottom = fold.offsetHeight;
      for (let el: HTMLElement | null = fold; el && !el.hasAttribute("data-sheet-clip"); el = el.offsetParent as HTMLElement | null) {
        bottom += el.offsetTop;
      }
      setSheetFold(Math.ceil(bottom));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (fold.offsetParent) observer.observe(fold.offsetParent);
    observer.observe(fold);
    return () => observer.disconnect();
  }, [sheetPlace, selectedId, listMode, isDesktop]);

  const pageRef = useRef<HTMLDivElement>(null);
  useSwipeBetween(pageRef, {
    enabled: listMode && !isDesktop && selected !== null,
    hasPrev: prevReady,
    hasNext: nextReady,
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

  useEffect(() => {
    const root = listMode ? pageRef.current : sheetSwipeRef.current;
    if (!root) return;
    let live = true;
    for (const slide of slides) {
      const id = slide.place.id;
      if (slide.offset === 0 || decoded[id]) continue;
      const pages = root.querySelectorAll(`[data-place="${CSS.escape(id)}"]`);
      if (pages.length === 0) continue;
      const images = [...pages].flatMap((page) => [...page.querySelectorAll("img")]);
      const done = () => {
        if (live) setDecoded((current) => (current[id] ? current : { ...current, [id]: true }));
      };
      // A picture that fails to decode won't get better; the swipe shouldn't wait on it forever.
      void Promise.all(images.map((img) => img.decode().catch(() => {}))).then(done);
    }
    return () => {
      live = false;
    };
  }, [slides, listMode, isDesktop, decoded]);

  // The first tap asks for permission; the map centers once the first fix arrives.
  const locateWhenFound = useRef(false);
  const locate = () => {
    if (here.position) mapRef.current?.locate(here.position);
    else locateWhenFound.current = true;
    here.start();
  };
  useEffect(() => {
    if (!here.position || !locateWhenFound.current) return;
    locateWhenFound.current = false;
    mapRef.current?.locate(here.position);
  }, [here.position]);
  useEffect(() => {
    if (here.status !== "on" && here.status !== "locating") locateWhenFound.current = false;
  }, [here.status]);
  // Location is asked for on load; only a locate tap earns a message about it.
  const notice = here.asked ? locationMessage(here.status) : null;

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

  const changeQuery = (next: string) => {
    setQuery(next);
    if (isSearching(next) || isSearching(query)) setSelectedId(null);
  };
  const search: SearchControls = {
    query,
    open: searchOpen,
    count: searching ? visible.length : null,
    onOpen: () => setSearchOpen(true),
    onChange: changeQuery,
    onCancel: () => {
      changeQuery("");
      setSearchOpen(false);
    },
  };
  const shownQuery = `“${query.trim()}”`;

  // A section with nothing for the chosen pills points to the matches in other sections.
  let noMatches: NoMatches | undefined;
  if (visible.length === 0 && hits?.size === 0) {
    noMatches = {
      title: `No spots match ${shownQuery}`,
      body: "Check the spelling, or try something broader like a neighborhood or “coffee”.",
      actions: <Button onClick={search.onCancel}>Clear search</Button>,
    };
  } else if (visible.length === 0 && hits && hits.size > 0 && hasActiveFilters(filters)) {
    noMatches = {
      title: `No spots match ${shownQuery} with these filters`,
      body: `${hits.size} ${hits.size === 1 ? "place matches" : "places match"} without them.`,
      actions: (
        <>
          <Button onClick={clearFilters}>Clear filters</Button>
          <Button variant="outline" onClick={search.onCancel}>
            Clear search
          </Button>
        </>
      ),
    };
  } else if (visible.length === 0 && filters.saved && !places.some((p) => savedIds.has(p.id))) {
    noMatches = {
      title: "Nothing saved yet",
      body: "Tap the bookmark on any place to keep it here. Saves stay on this device.",
      actions: <Button onClick={() => changeFilters({ ...filters, saved: false })}>Show all places</Button>,
    };
  } else if (visible.length === 0 && filters.category && elsewhere > 0) {
    const pillLabels = [
      ...(filters.saved ? ["Saved"] : []),
      ...(filters.openNow ? ["Open now"] : []),
      ...filters.pills.map((p) => getPill(p).label),
    ];
    noMatches = {
      title: `Nothing in ${getCategory(filters.category).plural} matches ${pillLabels.join(" + ")}`,
      body: `But ${elsewhere} ${elsewhere === 1 ? "place" : "places"} in other sections ${elsewhere === 1 ? "does" : "do"}.`,
      actions: (
        <>
          <Button onClick={() => changeFilters({ ...filters, category: null })}>
            Show {elsewhere === 1 ? "it" : `those ${elsewhere}`}
          </Button>
          <Button variant="outline" onClick={() => changeFilters({ ...filters, pills: [], openNow: false, saved: false })}>
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
    driveTimes: travel,
    now: clocks.now,
  };
  const filterProps = {
    search,
    filters,
    onChange: changeFilters,
    neighborhoods,
    categories,
    pillCounts: counts,
    openNowCount,
    savedCount,
  };

  return (
    <main
      data-explorer
      className="relative h-dvh w-full overflow-hidden bg-canvas"
      style={viewportHeight ? { height: viewportHeight } : undefined}
    >
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
          fitKey={JSON.stringify({ filters, q: isSearching(settledQuery) ? normalize(settledQuery) : "" })}
          showEveryPin={filtersActive || searching}
          onSelect={select}
          onHighlight={setHighlightedId}
          onBackgroundClick={closeDetail}
          glide={stepping !== null}
          swipeNeighbors={
            !listMode && !isDesktop && selected ? [prev?.id, next?.id].filter((id) => id !== undefined) : undefined
          }
          userPosition={here.position}
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
              sort={sortMode}
              onSort={setSortMode}
            />
          </header>
          <div ref={railListRef} className="overlay-scroll-y scroll-fade-y min-h-0 flex-1 px-3 pt-1 pb-6">
            <PlaceList variant="rows" sections={sections} {...listProps} />
            <MapCredit className="mt-6 px-3" />
          </div>
        </div>
        {/* Painted in the place color itself, so the glass inside still has a color to blur under the fade's mask. */}
        {selected && (
          <div
            ref={railScrollRef}
            className="sheet-scroll-y scroll-fade-y min-h-0 flex-1 bg-(color:--tint) [transition:--tint_300ms_cubic-bezier(0.4,0,0.2,1)]"
            style={{ "--tint": placeColor(selected) } as React.CSSProperties}
          >
            <PlaceDetail
              place={selected}
              onBack={closeDetail}
              variant="rail"
              stepper={stepper}
              enterFrom={stepping?.direction}
              driveTimes={travel}
              now={clocks.now}
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
        <div className="glass flex flex-col overflow-hidden rounded-full">
          <LocateButton status={here.status} onClick={locate} />
          <span aria-hidden className="mx-3 h-px bg-[var(--glass-edge)]" />
          <MapButton label="Show all places" onClick={() => mapRef.current?.showAll()}>
            <Maximize size={18} />
          </MapButton>
        </div>
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
            footer={snap === "peek" ? <PlaceActions place={sheetPlace} ride={false} /> : undefined}
            accessory={<LocateButton status={here.status} onClick={locate} className="glass" />}
            cards
          >
            <PlaceDetail
              place={sheetPlace}
              onBack={closeDetail}
              variant="sheet"
              enterFrom={stepping?.direction}
              swiped={stepping?.swiped}
              slides={slides}
              driveTimes={travel}
              now={clocks.now}
            />
          </BottomSheet>
        </div>
      )}
      {!listMode && !selected && (
        <div className="glass absolute right-4 bottom-[calc(max(env(safe-area-inset-bottom),16px)+4px)] z-20 flex flex-col overflow-hidden rounded-full lg:hidden">
          <LocateButton status={here.status} onClick={locate} />
          <span aria-hidden className="mx-3 h-px bg-[var(--glass-edge)]" />
          <MapButton label="Show all places" onClick={() => mapRef.current?.showAll()}>
            <Maximize size={18} />
          </MapButton>
        </div>
      )}
      {!listMode && notice && (
        <LocationNotice message={notice} onDismiss={here.dismiss} top={isDesktop ? 16 : topBarHeight} />
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
          ref={listScrollRef}
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
            <div className="relative mx-auto max-w-7xl px-5 pt-[max(env(safe-area-inset-top),28px)] pb-2 lg:px-10 lg:pt-14">
              <h1 className="text-xl font-semibold text-balance lg:text-2xl">{site.title}</h1>
              <p className="mt-2 max-w-2xl text-base text-balance text-ink/80">
                {site.tagline}
              </p>
            </div>
          </header>
          <div className="sticky top-0 z-10">
            {/* Cards fade out under the top edge rather than being cut by it. A gradient, not a mask, so the pills' glass keeps blurring the cards. */}
            {barStuck && (
              <div
                aria-hidden
                className="relative h-[env(safe-area-inset-top)] bg-canvas after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-7 after:bg-linear-to-b after:from-canvas after:to-transparent"
              />
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
              sort={sortMode}
              onSort={setSortMode}
            />
            <div className="mt-2">
              <PlaceList
                sections={sections}
                gridClassName="grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-[repeat(auto-fill,minmax(224px,1fr))] lg:gap-x-6 lg:gap-y-10"
                {...listProps}
              />
            </div>
            <MapCredit className="mt-12 text-center" />
          </div>
        </div>
        {listMode && selected && (
          <div
            ref={pageRef}
            className="sheet-scroll-y absolute inset-0 touch-pan-y bg-(color:--tint) [transition:--tint_var(--open-tint)_var(--ease-out-soft)] animate-in duration-200 fade-in"
            style={{ "--tint": placeColor(selected) } as React.CSSProperties}
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
              driveTimes={travel}
              now={clocks.now}
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
