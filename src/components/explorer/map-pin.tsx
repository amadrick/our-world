import { getImageProps } from "next/image";
import { Star } from "react-feather";

import { shade } from "@/lib/images/palette.mjs";
import type { PinDisplay } from "@/lib/map/pin-layout";
import { ANDY_PICK, getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { placeColor } from "./place-detail";

/** The photo inside the ring, px. The thumbnail is a small derived image, a few KB. */
const THUMB = 34;

interface MapPinProps {
  place: Place;
  selected: boolean;
  highlighted: boolean;
  display: PinDisplay;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}

/**
 * The place's own photo in a ring of its page color, so the map, the list, and
 * the page share color; the name sits beside it in a pill of the same color.
 * Zoomed out, or crowded out by a neighbor, it's a dot of that color. On the
 * dark map the color is lifted and outlined so it doesn't sink into the land.
 */
export function MapPin({ place, selected, highlighted, display, onSelect, onHover }: MapPinProps) {
  const pick = place.andyFavorite === true;
  const color = placeColor(place);
  const colors = { "--pin": color, "--pin-dark": shade(color, 0.54, 1.1) } as React.CSSProperties;
  const fill = "bg-[var(--pin)] dark:bg-[var(--pin-dark)]";

  return (
    <button
      type="button"
      aria-label={`${place.name}, ${getCategory(place.category).label}${pick ? `, ${ANDY_PICK}` : ""}`}
      aria-pressed={selected}
      data-selected={selected || undefined}
      data-highlighted={highlighted || undefined}
      data-display={display}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerEnter={(event) => event.pointerType === "mouse" && onHover(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      style={colors}
      // The hit area reaches past the drawn pin so small pins stay easy to tap.
      className="group relative flex cursor-pointer items-center justify-center outline-none before:absolute before:-inset-2 before:content-['']"
    >
      {display === "dot" ? (
        <span
          className={cn(
            "flex items-center justify-center rounded-full text-white shadow-pin ring-[1.5px] ring-white dark:ring-white/60",
            "transition-transform duration-200 group-hover:scale-125 group-focus-visible:ring-4 group-focus-visible:ring-white",
            fill,
            pick ? "size-4" : "size-3",
          )}
        >
          {pick && <Star size={8} fill="currentColor" aria-hidden />}
        </span>
      ) : (
        <span
          className={cn(
            "relative flex size-10 items-center justify-center",
            "transition-[scale] duration-200 ease-snappy motion-reduce:transition-none",
            selected ? "scale-[1.18]" : highlighted ? "scale-110" : "group-hover:scale-110",
          )}
        >
          {display === "label" && (
            <span
              className={cn(
                "absolute top-1/2 left-0 flex h-10 -translate-y-1/2 items-center rounded-full pr-3.5 pl-11 text-sm font-semibold whitespace-nowrap text-white shadow-pin dark:ring-1 dark:ring-white/50",
                fill,
                selected && "ring-2 ring-white dark:ring-2 dark:ring-white",
              )}
            >
              <span className="max-w-44 truncate">{smartQuotes(place.name)}</span>
            </span>
          )}
          <span
            className={cn(
              "relative flex size-10 items-center justify-center rounded-full shadow-pin dark:ring-1 dark:ring-white/50",
              "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-white",
              fill,
              selected && "ring-2 ring-white dark:ring-2 dark:ring-white",
            )}
          >
            <Thumbnail place={place} />
            {pick && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 flex size-[18px] items-center justify-center rounded-full bg-white text-[#141414] shadow-pin"
              >
                <Star size={10} fill="currentColor" />
              </span>
            )}
          </span>
        </span>
      )}
    </button>
  );
}

function Thumbnail({ place }: { place: Place }) {
  if (!place.image) return null;
  const { props } = getImageProps({ src: place.image, alt: "", width: THUMB, height: THUMB });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a portal into a map marker; getImageProps gives next/image's srcset
    <img
      {...props}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className="size-[34px] rounded-full object-cover"
    />
  );
}
