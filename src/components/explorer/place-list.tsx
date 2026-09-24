"use client";

import { MapPin, Search, Star, type Icon } from "react-feather";

import { PlaceImage } from "@/components/places/place-image";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";

interface PlaceListProps {
  places: Place[];
  totalCount: number;
  selectedId: string | null;
  highlightedId: string | null;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
  onClearFilters: () => void;
}

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
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <EmptyIcon size={22} className="text-muted-foreground" />
      <p className="mt-4 text-base font-medium">{title}</p>
      <p className="mt-1 max-w-[18rem] text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PlaceCard({
  place,
  active,
  onSelect,
  onHighlight,
}: {
  place: Place;
  active: boolean;
  onSelect: () => void;
  onHighlight: (hovering: boolean) => void;
}) {
  const pick = place.tags.includes("top-pick");
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={(event) => event.pointerType === "mouse" && onHighlight(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHighlight(false)}
      className={cn(
        "group flex w-full cursor-pointer flex-col gap-2 rounded-[22px] p-1.5 text-left transition-colors",
        "hover:bg-white/40 focus-visible:bg-white/40 focus-visible:outline-none active:bg-white/55",
        active && "bg-white/45",
      )}
    >
      <PlaceImage
        place={place}
        sizes="(min-width: 1024px) 180px, 46vw"
        className="rounded-[14px]"
        imageClassName="transition-transform duration-300 ease-out group-hover:scale-[1.03]"
      />
      <span className="block min-w-0 px-1.5 pb-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-base font-medium">{smartQuotes(place.name)}</span>
          {pick && <Star size={12} fill="currentColor" className="shrink-0" aria-label="Top pick" />}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {getCategory(place.category).label}
          {place.neighborhood && ` · ${place.neighborhood}`}
        </span>
      </span>
    </button>
  );
}

export function PlaceList({
  places,
  totalCount,
  selectedId,
  highlightedId,
  onSelect,
  onHighlight,
  onClearFilters,
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

  if (places.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Nothing matches those filters"
        body="Try removing a filter or two to see more places."
        action={
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-1">
      {places.map((place) => (
        <li key={place.id}>
          <PlaceCard
            place={place}
            active={place.id === selectedId || place.id === highlightedId}
            onSelect={() => onSelect(place.id)}
            onHighlight={(hovering) => onHighlight(hovering ? place.id : null)}
          />
        </li>
      ))}
    </ul>
  );
}
