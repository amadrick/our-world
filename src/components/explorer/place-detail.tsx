"use client";

import {
  Check,
  ChevronLeft,
  Copy,
  Map as MapIcon,
  MapPin,
  Navigation,
  Share,
  Star,
  X,
} from "react-feather";
import { useState } from "react";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/places/category-badge";
import { PhotoDissolve } from "@/components/places/photo-dissolve";
import { PlaceImage } from "@/components/places/place-image";
import { TagIcon } from "@/components/places/tag-icon";
import { site } from "@/config/site";
import { appleMapsUrl, googleMapsUrl } from "@/lib/places/links";
import { ANDY_PICK, FILTER_TAGS, getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";

/** For a place saved before its photo's color was sampled. */
const FALLBACK_COLOR = "#3a3632";

/** The color a place's detail sits on, sampled from its photo when the photo was saved. */
export function placeColor(place: Place): string {
  return place.imageColor ?? FALLBACK_COLOR;
}

function placeWhere(place: Place) {
  return [getCategory(place.category).label, place.neighborhood].filter(Boolean).join(" · ");
}

async function sharePlace(place: Place) {
  const url = new URL(window.location.href);
  url.searchParams.set("place", place.id);
  const link = url.toString();
  if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title: place.name, url: link });
    } catch {
      // Dismissing the share sheet is not an error.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    toast.success("Link copied", { description: smartQuotes(place.name) });
  } catch {
    toast.error("Couldn’t copy the link", { description: link });
  }
}

/** A round smoked-glass control floating over the photo. */
function FloatingButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="pressable glass-media pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-full outline-white focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </button>
  );
}

function AndyPickChip() {
  return (
    <p className="glass-tinted inline-flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-sm font-semibold">
      <Star size={13} fill="currentColor" aria-hidden />
      {ANDY_PICK}
    </p>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white/70">Address</p>
        <p className="text-base font-semibold text-pretty select-text">{address}</p>
      </div>
      <button
        type="button"
        title="Copy address"
        aria-label={copied ? "Address copied" : `Copy address: ${address}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            toast.success("Address copied", { description: address });
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            // Clipboard access can be blocked; the address is still selectable.
          }
        }}
        className="pressable glass-tinted flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
    </div>
  );
}

/** Open in Apple Maps (the bright pill) or Google Maps (glass beside it). */
export function PlaceActions({ place }: { place: Place }) {
  const pill =
    "pressable flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 text-base font-semibold outline-white focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <div className="flex gap-3">
      <a
        href={appleMapsUrl(place)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(pill, "bg-white text-[#141414] hover:bg-white/90")}
      >
        <Navigation size={18} aria-hidden />
        Apple Maps
      </a>
      <a
        href={googleMapsUrl(place)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(pill, "glass-tinted hover:bg-white/20")}
      >
        <MapPin size={18} aria-hidden />
        Google Maps
      </a>
    </div>
  );
}

/** The name and quiet meta at the top of the phone map sheet (with a thumbnail when peeking). */
export function PlaceSheetHeader({
  place,
  showThumbnail,
  onClose,
}: {
  place: Place;
  showThumbnail: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 pt-1 pb-4 text-white">
      {showThumbnail && (
        <PlaceImage
          place={place}
          sizes="56px"
          placeholder={placeColor(place)}
          className="w-14 shrink-0 rounded-md"
        />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          <span className="truncate">{smartQuotes(place.name)}</span>
          {place.andyFavorite && (
            <Star size={15} fill="currentColor" className="shrink-0" aria-label={ANDY_PICK}>
              <title>{ANDY_PICK}</title>
            </Star>
          )}
        </h2>
        <p className="flex items-center gap-1.5 truncate text-sm text-white/75">
          <CategoryIcon category={place.category} size={14} className="shrink-0" />
          {placeWhere(place)}
        </p>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="pressable glass-tinted flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <X size={20} aria-hidden />
      </button>
    </div>
  );
}

interface PlaceDetailProps {
  place: Place;
  onBack: () => void;
  /** Switches to the map with this place in view. */
  onShowOnMap?: () => void;
  /**
   * "page": list mode, full screen, Apple Music style: the photo runs edge to
   * edge across the top and dissolves into the page color, with everything
   * else set right on it in a centered reading column.
   * "rail": inside the desktop map rail, the same at rail width.
   * "sheet": inside the phone map sheet, whose header shows the name and whose
   * footer holds the actions.
   * All three sit on the place's color; the caller paints it behind them.
   */
  variant: "page" | "rail" | "sheet";
}

export function PlaceDetail({ place, onBack, onShowOnMap, variant }: PlaceDetailProps) {
  const color = placeColor(place);
  const tags = FILTER_TAGS.filter((t) => place.tags.includes(t.id));
  const page = variant === "page";
  const alt = `${place.name}${place.neighborhood ? ` in ${place.neighborhood}` : ""}, as a grainy film-style picture`;

  const controls = variant !== "sheet" && (
    <div className="pointer-events-none flex items-center justify-between gap-2">
      <FloatingButton label="All places" onClick={onBack}>
        <ChevronLeft size={22} aria-hidden />
      </FloatingButton>
      <div className="flex gap-2">
        <FloatingButton label="Share" onClick={() => void sharePlace(place)}>
          <Share size={18} aria-hidden />
        </FloatingButton>
        {onShowOnMap && (
          <FloatingButton label="Show on map" onClick={onShowOnMap}>
            <MapIcon size={18} aria-hidden />
          </FloatingButton>
        )}
      </div>
    </div>
  );

  const header = variant !== "sheet" && (
    <header className="space-y-3 [text-shadow:0_1px_16px_rgb(0_0_0/0.22)]">
      {place.andyFavorite && <AndyPickChip />}
      <h2 className={cn("text-xl font-semibold text-balance", page && "md:text-2xl")}>
        {smartQuotes(place.name)}
      </h2>
      <p className="flex items-center gap-2 text-base font-medium text-white/75">
        <CategoryIcon category={place.category} size={16} />
        {placeWhere(place)}
      </p>
    </header>
  );

  const details = (
    <div className="space-y-8">
      {variant === "sheet" && place.andyFavorite && <AndyPickChip />}
      {(place.signatureSubject || tags.length > 0) && (
        <div className="space-y-4">
          {place.signatureSubject && (
            <div>
              <p className="text-sm font-medium text-white/70">Known for</p>
              <p className="text-lg font-semibold text-pretty">
                {smartQuotes(place.signatureSubject)}
              </p>
            </div>
          )}
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Good to know">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="glass-tinted flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium"
                >
                  <TagIcon tag={tag.id} />
                  {tag.badge}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {place.note && (
        <figure className="border-l-2 border-white/30 pl-4">
          <blockquote className="text-base">{smartQuotes(place.note)}</blockquote>
          <figcaption className="mt-2 text-sm font-medium text-white/70">{site.hosts}</figcaption>
        </figure>
      )}
      {place.summary && (
        <div>
          <p className="text-base text-white/85">{smartQuotes(place.summary)}</p>
          {place.summarySource === "placeholder" && (
            <p className="mt-2 text-sm text-white/70">A fuller description is on the way.</p>
          )}
        </div>
      )}
      {place.address && <CopyAddress address={place.address} />}
    </div>
  );

  if (variant === "sheet") {
    return (
      <article aria-label={place.name} className="flex flex-col gap-6 text-white">
        <PlaceImage
          place={place}
          alt={alt}
          priority
          sizes="100vw"
          placeholder={color}
          className="aspect-[5/4] rounded-xl"
        />
        <div className="px-1">{details}</div>
      </article>
    );
  }

  if (variant === "rail") {
    return (
      <article aria-label={place.name} className="relative text-white">
        <div className="absolute inset-x-3 top-3 z-10">{controls}</div>
        <div className="relative">
          <PlaceImage place={place} alt={alt} priority sizes="400px" placeholder={color} />
          <PhotoDissolve color={color} className="h-[55%]" />
        </div>
        <div className="relative -mt-20 space-y-6 px-6 pb-8">
          {header}
          <PlaceActions place={place} />
          {details}
        </div>
      </article>
    );
  }

  return (
    <article aria-label={place.name} className="relative min-h-full text-white">
      {/* Floats over the photo and stays in reach while scrolling. */}
      <div className="sticky top-0 z-20 h-0">
        <div className="px-4 pt-[max(env(safe-area-inset-top),12px)] md:px-8 md:pt-6">{controls}</div>
      </div>

      <div className="relative">
        <PlaceImage
          place={place}
          alt={alt}
          priority
          sizes="100vw"
          placeholder={color}
          className="md:aspect-auto md:h-[min(72vh,760px)]"
        />
        {/* A soft shade under the status bar and the floating buttons. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/30 to-transparent"
        />
        <PhotoDissolve color={color} className="h-[58%] md:h-[42%]" />
      </div>

      <div className="relative mx-auto max-w-2xl space-y-6 px-5 -mt-24 md:-mt-36 md:space-y-7 md:px-8">
        {header}
        <div className="md:max-w-md">
          <PlaceActions place={place} />
        </div>
      </div>

      <div className="relative mx-auto max-w-2xl px-5 pt-10 pb-36 md:px-8 md:pt-12 md:pb-24">
        {details}
      </div>
    </article>
  );
}
