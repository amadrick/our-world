"use client";

import { ChevronRight, MapPinned, SearchX, Star } from "lucide-react";

import { CategoryBadge } from "@/components/places/category-badge";
import { Button } from "@/components/ui/button";
import { getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
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
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof SearchX;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-[16px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[18rem] text-[14px] leading-relaxed text-muted-foreground">{body}</p>
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
  const category = getCategory(place.category);
  const pick = place.tags.includes("andys-pick");
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={(event) => event.pointerType === "mouse" && onHighlight(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHighlight(false)}
      className={cn(
        "group flex w-full cursor-pointer items-start gap-3 rounded-2xl p-3 text-left transition-colors",
        "hover:bg-black/[0.035] focus-visible:bg-black/[0.035] focus-visible:outline-none active:bg-black/[0.06]",
        active && "bg-black/[0.035]",
      )}
    >
      <CategoryBadge category={place.category} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[16px] leading-tight font-semibold tracking-[-0.01em]">
            {place.name}
          </span>
          {pick && (
            <Star
              className="size-3.5 shrink-0 fill-amber-400 text-amber-400"
              aria-label="Andy's pick"
            />
          )}
        </span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">
          {category.label}
          {place.neighborhood && ` · ${place.neighborhood}`}
        </span>
        <span className="mt-1.5 line-clamp-2 text-[14px] leading-snug text-foreground/75">
          {place.note || place.summary}
        </span>
      </span>
      <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
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
        icon={MapPinned}
        title="No places yet"
        body="Andy is still putting together recommendations. Check back soon."
      />
    );
  }

  if (places.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="Nothing matches those filters"
        body="Try removing a filter or two to see more places."
        action={
          <Button variant="outline" className="h-10 rounded-full px-5" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }

  return (
    <ul className="space-y-0.5">
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
