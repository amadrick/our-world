"use client";

import { MapPin, Search, Star, type Icon } from "react-feather";

import { PlaceImage } from "@/components/places/place-image";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { signatureShort } from "@/lib/places/signature";
import { getCategory, isFavorite, pickLabel } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { formatTravelShort, type TravelEstimate } from "@/lib/geo/travel-estimate";
import { openState, shortHoursLine } from "@/lib/places/hours";
import { TravelGlyph } from "./place-detail";

/** A more specific message than "nothing matches", with ways out. */
export interface NoMatches {
  title: string;
  body: string;
  actions: React.ReactNode;
}

interface PlaceListProps {
  places: Place[];
  /** Big listing cards for list mode, or compact rows beside the map. */
  variant?: "grid" | "rows";
  /** Grid columns and gaps, e.g. "grid-cols-2 gap-x-3 gap-y-6". */
  gridClassName?: string;
  totalCount: number;
  selectedId: string | null;
  highlightedId: string | null;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
  onClearFilters: () => void;
  noMatches?: NoMatches;
  /** Driving time from the reader, in seconds, by place id. */
  driveTimes?: Readonly<Record<string, TravelEstimate>> | null;
  /** The time in San Francisco, for each place's hours line. */
  now?: Date;
  /** Headed groups (the Near you order's "Good right now", "Closed now"…); otherwise one grid. */
  sections?: { id: string; title: string; places: Place[] }[];
}

/** A card's hours line, and whether it's closed now (muted). */
function hoursFor(place: Place, now: Date | undefined) {
  if (!now) return { line: null, closed: false };
  const state = openState(place.hours, now);
  return { line: shortHoursLine(state, now), closed: state.kind === "closed" };
}

/** "12 min" for the tight spots, where the card or row already says what it is. */

function EmptyState({
  icon: EmptyIcon,
  title,
  body,
  action,
}: {
  icon: Icon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="glass flex size-14 items-center justify-center rounded-full">
        <EmptyIcon size={22} />
      </span>
      <p className="mt-5 text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-[20rem] text-base text-balance text-muted-foreground">{body}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

function placeMeta(place: Place) {
  const where = [getCategory(place.category).label, place.neighborhood].filter(Boolean).join(" · ");
  const knownFor = place.signatureSubject ? smartQuotes(signatureShort(place.signatureSubject)) : null;
  return { where, knownFor };
}

/** Airbnb-style listing card: the picture on top, then name and two quiet lines of detail. */
export function PlaceCard({
  place,
  active,
  onSelect,
  onHighlight,
  drive,
  now,
}: {
  place: Place;
  active: boolean;
  onSelect: () => void;
  onHighlight: (hovering: boolean) => void;
  drive?: TravelEstimate;
  now?: Date;
}) {
  const label = pickLabel(place.pickBy);
  const { where, knownFor } = placeMeta(place);
  const hours = hoursFor(place, now);
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={(event) => event.pointerType === "mouse" && onHighlight(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHighlight(false)}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-xl text-left outline-ink transition-opacity duration-300 focus-visible:outline-2 focus-visible:outline-offset-4",
        hours.closed && "opacity-55 hover:opacity-100",
      )}
    >
      <span className="relative block">
        <PlaceImage
          place={place}
          sizes="(min-width: 1024px) 260px, (min-width: 640px) 30vw, 46vw"
          className={cn(
            "image-frame rounded-xl transition-shadow duration-200",
            active && "shadow-float",
          )}
          imageClassName="transition-transform duration-500 ease-snappy group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        {label && (
          <span className="glass-media absolute top-2 left-2 flex h-7 items-center gap-1 rounded-full pr-2.5 pl-2 text-sm font-semibold sm:top-2.5 sm:left-2.5 sm:h-8 sm:gap-1.5 sm:pr-3 sm:pl-2.5">
            <Star size={12} fill="currentColor" aria-hidden />
            {label}
          </span>
        )}
        {drive != null && (
          <span className="glass-media absolute bottom-2 left-2 flex h-7 items-center gap-1.5 rounded-full pr-2.5 pl-2 text-sm font-semibold sm:bottom-2.5 sm:left-2.5">
            <TravelGlyph travel={drive} size={14} />
            {formatTravelShort(drive)}
            <span className="sr-only"> {drive.mode}</span>
          </span>
        )}
      </span>
      <span className="block min-w-0 px-0.5">
        <span className="block truncate text-base font-semibold">{smartQuotes(place.name)}</span>
        {knownFor && (
          <span className="block truncate text-sm text-muted-foreground">{knownFor}</span>
        )}
        <span className="block truncate text-sm text-muted-foreground">{where}</span>
        {hours.line && <span className="block truncate text-sm text-muted-foreground">{hours.line}</span>}
      </span>
    </button>
  );
}

/** A compact row for the rail beside the map: thumbnail, name, what it's known for, where. */
export function PlaceRow({
  place,
  active,
  onSelect,
  onHighlight,
  drive,
  now,
}: {
  place: Place;
  active: boolean;
  onSelect: () => void;
  onHighlight: (hovering: boolean) => void;
  drive?: TravelEstimate;
  now?: Date;
}) {
  const favorite = isFavorite(place);
  const label = pickLabel(place.pickBy);
  const { where, knownFor } = placeMeta(place);
  const hours = hoursFor(place, now);
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={(event) => event.pointerType === "mouse" && onHighlight(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHighlight(false)}
      className={cn(
        "focus-ring flex w-full items-center gap-4 rounded-lg p-2 text-left transition-colors hover:bg-hover",
        active && "bg-hover",
        hours.closed && "opacity-55 hover:opacity-100",
      )}
    >
      <PlaceImage place={place} sizes="72px" className="image-frame w-18 shrink-0 rounded-md" />
      <span className="block min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-base font-semibold">{smartQuotes(place.name)}</span>
          {favorite && (
            <Star size={14} fill="currentColor" className="shrink-0" aria-label={label ?? "Favorite"}>
              <title>{label ?? "Favorite"}</title>
            </Star>
          )}
        </span>
        {knownFor && (
          <span className="block truncate text-sm text-muted-foreground">{knownFor}</span>
        )}
        <span className="flex min-w-0 gap-1 text-sm text-muted-foreground">
          <span className="truncate">{where}</span>
          {drive != null && (
            <span className="shrink-0">
              · {formatTravelShort(drive)}
              <span className="sr-only"> {drive.mode}</span>
            </span>
          )}
        </span>
        {hours.line && <span className="block truncate text-sm text-muted-foreground">{hours.line}</span>}
      </span>
    </button>
  );
}

export function PlaceList({
  places,
  variant = "grid",
  gridClassName = "grid-cols-2 gap-x-3 gap-y-6",
  totalCount,
  selectedId,
  highlightedId,
  onSelect,
  onHighlight,
  onClearFilters,
  noMatches,
  driveTimes,
  now,
  sections,
}: PlaceListProps) {
  if (totalCount === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No places yet"
        body={`${site.hosts} are still putting together their recommendations. Check back soon.`}
      />
    );
  }

  if (places.length === 0 && noMatches) {
    return (
      <EmptyState
        icon={Search}
        title={noMatches.title}
        body={noMatches.body}
        action={noMatches.actions}
      />
    );
  }

  if (places.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Nothing matches those filters"
        body="Try removing a filter or two to see more places."
        action={
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }

  const Item = variant === "rows" ? PlaceRow : PlaceCard;
  const grid = (list: Place[]) => (
    <ul className={cn("grid", variant === "rows" ? "grid-cols-1 gap-1" : gridClassName)}>
      {list.map((place) => (
        <li key={place.id}>
          <Item
            place={place}
            active={place.id === selectedId || place.id === highlightedId}
            onSelect={() => onSelect(place.id)}
            onHighlight={(hovering) => onHighlight(hovering ? place.id : null)}
            drive={driveTimes?.[place.id]}
            now={now}
          />
        </li>
      ))}
    </ul>
  );
  if (!sections) return grid(places);
  return (
    <div className={variant === "rows" ? "space-y-4" : "space-y-9"}>
      {sections.map((section) => (
        <section key={section.id} aria-label={section.title}>
          <h2 className={cn("text-sm font-semibold text-muted-foreground", variant === "rows" ? "mb-1 px-2" : "mb-3")}>
            {section.title}
          </h2>
          {grid(section.places)}
        </section>
      ))}
    </div>
  );
}
