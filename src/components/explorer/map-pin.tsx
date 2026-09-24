import { Star } from "react-feather";

import { CategoryIcon } from "@/components/places/category-badge";
import { getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";

interface MapPinProps {
  place: Place;
  selected: boolean;
  highlighted: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}

export function MapPin({ place, selected, highlighted, onSelect, onHover }: MapPinProps) {
  const pick = place.tags.includes("top-pick");
  const showLabel = selected || highlighted;

  return (
    <button
      type="button"
      aria-label={`${place.name}, ${getCategory(place.category).label}`}
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
      className="group relative flex cursor-pointer items-center outline-none"
    >
      <span
        className={cn(
          "relative flex size-7 items-center justify-center rounded-full bg-foreground text-white ring-2 ring-white transition-transform duration-200 ease-out group-focus-visible:ring-4 group-focus-visible:ring-black/20 lg:size-8 [&_svg]:size-3.5 lg:[&_svg]:size-[15px]",
          "shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45)]",
          selected ? "scale-[1.25]" : highlighted && "scale-110",
        )}
      >
        <CategoryIcon category={place.category} size={15} />
        {pick && (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full hairline border-black/15 bg-white text-foreground"
          >
            <Star size={10} fill="currentColor" />
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-[calc(100%+8px)] -translate-y-1/2 rounded-full hairline border-black/10 bg-white px-3 py-1 text-sm font-medium whitespace-nowrap shadow-float transition-all duration-200",
          showLabel ? "opacity-100" : "-translate-x-1 opacity-0",
        )}
      >
        {smartQuotes(place.name)}
      </span>
    </button>
  );
}
