import { memo } from "react";
import { getImageProps } from "next/image";
import { Star } from "react-feather";

import { CATEGORY_ICONS } from "@/components/places/category-badge";
import type { PinDisplay } from "@/lib/map/pin-layout";
import { CATEGORY_COLORS, PIN, pinKind } from "@/lib/map/pin-style";
import { ANDY_PICK, getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";

interface MapPinProps {
  place: Place;
  selected: boolean;
  highlighted: boolean;
  display: PinDisplay;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
}

/**
 * A pin in Apple Maps' language (see pin-style.ts): the big stuff is a round
 * photo with a grey caption below, the rest a glyph in its category color with
 * the name beside it. Selected, it grows into a balloon whose tip marks the
 * spot. Hidden pins stay mounted, faded out, so they pop in when there's room.
 */
export const MapPin = memo(function MapPin({ place, selected, highlighted, display, onSelect, onHighlight }: MapPinProps) {
  const pick = place.andyFavorite === true;
  const kind = pinKind(place.category);
  const color = CATEGORY_COLORS[place.category];
  const Glyph = CATEGORY_ICONS[place.category];
  const hidden = display === "hidden";

  return (
    <button
      type="button"
      aria-label={`${place.name}, ${getCategory(place.category).label}${pick ? `, ${ANDY_PICK}` : ""}`}
      aria-pressed={selected}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      data-kind={kind}
      data-display={display}
      data-selected={selected || undefined}
      data-highlighted={highlighted || undefined}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(place.id);
      }}
      onPointerEnter={(event) => event.pointerType === "mouse" && onHighlight(place.id)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHighlight(null)}
      onFocus={() => onHighlight(place.id)}
      onBlur={() => onHighlight(null)}
      style={
        {
          "--cat": color.fill,
          "--cat-label": color.label,
          "--cat-label-dark": color.labelDark,
        } as React.CSSProperties
      }
      className="map-pin group"
    >
      <span className="map-pin-head">
        <span className="map-pin-face">
          {kind === "photo" ? (
            <Thumbnail place={place} />
          ) : (
            <Glyph size={PIN.glyphIcon} strokeWidth={2.6} aria-hidden />
          )}
        </span>
      </span>
      {pick && (
        <span aria-hidden className="map-pin-star">
          <Star size={7} fill="currentColor" strokeWidth={0} />
        </span>
      )}
      <span aria-hidden className="map-pin-name">
        {smartQuotes(place.name)}
      </span>
    </button>
  );
});

function Thumbnail({ place }: { place: Place }) {
  if (!place.image) return null;
  // Sized for the selected balloon, so growing into it stays sharp.
  const { props } = getImageProps({ src: place.image, alt: "", width: PIN.photoSelected, height: PIN.photoSelected });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a portal into a map marker; getImageProps gives next/image's srcset
    <img {...props} alt="" loading="lazy" decoding="async" draggable={false} className="size-full rounded-full object-cover" />
  );
}
