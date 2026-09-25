import { Star } from "react-feather";

import { CategoryIcon } from "@/components/places/category-badge";
import { ANDY_PICK, getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";

/** How much each pin says at the current zoom: a dot, the category glyph, or glyph and name. */
export type PinDensity = "dot" | "glyph" | "label";

interface MapPinProps {
  place: Place;
  selected: boolean;
  highlighted: boolean;
  density: PinDensity;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}

/**
 * A price-pill-style marker: a white capsule with the category glyph (and the
 * name up close), inverted to ink when selected. Hovered and selected pins
 * always show their name.
 */
export function MapPin({ place, selected, highlighted, density, onSelect, onHover }: MapPinProps) {
  const pick = place.andyFavorite === true;
  const showName = selected || highlighted || density === "label";
  const dot = density === "dot" && !showName;

  return (
    <button
      type="button"
      aria-label={`${place.name}, ${getCategory(place.category).label}${pick ? `, ${ANDY_PICK}` : ""}`}
      aria-pressed={selected}
      data-selected={selected || undefined}
      data-highlighted={highlighted || undefined}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerEnter={(event) => event.pointerType === "mouse" && onHover(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      // The hit area reaches past the drawn pill so small pins stay easy to tap.
      className="group relative flex cursor-pointer items-center justify-center outline-none before:absolute before:-inset-2 before:content-['']"
    >
      {dot && pick ? (
        <span className="flex size-[18px] items-center justify-center rounded-full bg-ink text-white shadow-pin ring-2 ring-white transition-transform duration-200 group-hover:scale-125 group-focus-visible:ring-4 group-focus-visible:ring-ink/30">
          <Star size={10} fill="currentColor" />
        </span>
      ) : dot ? (
        <span className="block size-3 rounded-full bg-ink shadow-pin ring-2 ring-white transition-transform duration-200 group-hover:scale-125 group-focus-visible:ring-4 group-focus-visible:ring-ink/30" />
      ) : (
        <span
          className={cn(
            "relative flex h-8 items-center gap-1.5 rounded-full text-sm font-semibold whitespace-nowrap shadow-pin",
            "transition-[scale,background-color,color] duration-200 ease-snappy motion-reduce:transition-none",
            "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink",
            showName ? "pr-3 pl-2.5" : "w-8 justify-center",
            selected
              ? "scale-110 bg-ink text-white"
              : cn("bg-surface text-ink", highlighted ? "scale-110" : "group-hover:scale-110"),
          )}
        >
          <CategoryIcon category={place.category} size={15} className="shrink-0" />
          {showName && <span className="max-w-40 truncate">{smartQuotes(place.name)}</span>}
          {pick && (
            <span
              aria-hidden
              className={cn(
                "absolute -top-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full shadow-pin",
                selected ? "bg-surface text-ink" : "bg-ink text-white",
              )}
            >
              <Star size={10} fill="currentColor" />
            </span>
          )}
        </span>
      )}
    </button>
  );
}
