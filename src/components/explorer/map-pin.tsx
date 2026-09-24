import { Star } from "lucide-react";

import { CategoryIcon } from "@/components/places/category-badge";
import { getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { cn } from "@/lib/utils";

interface MapPinProps {
  place: Place;
  selected: boolean;
  highlighted: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}

export function MapPin({ place, selected, highlighted, onSelect, onHover }: MapPinProps) {
  const { color, label } = getCategory(place.category);
  const pick = place.tags.includes("andys-pick");
  const showLabel = selected || highlighted;

  return (
    <button
      type="button"
      aria-label={`${place.name}, ${label}`}
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
      className="group relative flex cursor-pointer flex-col items-center outline-none"
    >
      <span
        className={cn(
          "relative flex origin-bottom flex-col items-center transition-transform duration-200 ease-out",
          selected ? "scale-[1.28]" : highlighted ? "scale-110" : "scale-100",
        )}
      >
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full border-2 border-white text-white shadow-[0_2px_6px_rgb(0_0_0/0.25)] group-focus-visible:ring-2 group-focus-visible:ring-black/40 [&_svg]:size-4",
          )}
          style={{ backgroundColor: color }}
        >
          <CategoryIcon category={place.category} />
        </span>
        <span
          aria-hidden
          className="-mt-[5px] size-2.5 rotate-45 rounded-[2px] border-r-2 border-b-2 border-white shadow-[2px_2px_3px_rgb(0_0_0/0.15)]"
          style={{ backgroundColor: color }}
        />
        {pick && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1.5 flex size-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white"
          >
            <Star className="size-2.5 fill-white text-white" strokeWidth={0} />
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1 left-[calc(100%+6px)] rounded-full bg-white/95 px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-foreground shadow-[0_2px_8px_rgb(0_0_0/0.18)] transition-all duration-200",
          showLabel ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0",
          selected && "left-[calc(100%+12px)]",
        )}
      >
        {place.name}
      </span>
    </button>
  );
}
