"use client";

import { MapPin, Search, Star, type Icon } from "react-feather";

import { CategoryBadge } from "@/components/places/category-badge";
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
        "flex w-full cursor-pointer items-start gap-3.5 rounded-[20px] p-3 text-left transition-colors",
        "hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-none active:bg-secondary",
        active && "bg-secondary/70",
      )}
    >
      <CategoryBadge category={place.category} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-base font-medium">{smartQuotes(place.name)}</span>
          {pick && <Star size={12} fill="currentColor" className="shrink-0" aria-label="Top pick" />}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {getCategory(place.category).label}
          {place.neighborhood && ` · ${place.neighborhood}`}
        </span>
        <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {smartQuotes(place.note || place.summary)}
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
    <ul>
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
