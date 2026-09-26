"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Map as MapIcon,
  MapPin,
  Navigation,
  Share,
  Star,
  X,
} from "react-feather";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/places/category-badge";
import { PhotoDissolve } from "@/components/places/photo-dissolve";
import { PhotoHalo } from "@/components/places/photo-halo";
import { PlaceImage } from "@/components/places/place-image";
import { TagIcon } from "@/components/places/tag-icon";
import { site } from "@/config/site";
import { appleMapsUrl, googleMapsUrl } from "@/lib/places/links";
import { dissolveGradient, fadeOutMask } from "@/lib/progressive-blur";
import type { StepDirection } from "@/lib/places/swipe";
import { FILTER_TAGS, getCategory, isFavorite, pickLabel } from "@/lib/places/taxonomy";
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

export interface Stepper {
  prev: Place | null;
  next: Place | null;
  onStep: (direction: StepDirection) => void;
}

/** One painted page of the swipe strip, offset from the open place. */
export interface PlaceSlide {
  place: Place;
  offset: number;
}

/** Small glass chevrons to the previous and next place (the arrow keys do the same). */
function StepButtons({ stepper, className }: { stepper: Stepper; className?: string }) {
  const button = (direction: StepDirection, target: Place | null) => {
    const label = target
      ? `${direction === 1 ? "Next" : "Previous"}: ${smartQuotes(target.name)}`
      : direction === 1
        ? "No next place"
        : "No previous place";
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-keyshortcuts={direction === 1 ? "ArrowRight" : "ArrowLeft"}
        disabled={!target}
        onClick={() => stepper.onStep(direction)}
        className="pressable flex size-9 items-center justify-center rounded-full outline-white enabled:cursor-pointer enabled:hover:bg-white/15 focus-visible:outline-2 disabled:opacity-35"
      >
        {direction === 1 ? <ChevronRight size={20} aria-hidden /> : <ChevronLeft size={20} aria-hidden />}
      </button>
    );
  };
  return (
    <div className={cn("glass-media pointer-events-auto flex items-center gap-0.5 rounded-full p-1", className)}>
      {button(-1, stepper.prev)}
      {button(1, stepper.next)}
    </div>
  );
}

const enterSide = (direction: StepDirection | null | undefined) =>
  direction === 1 ? "next" : direction === -1 ? "prev" : undefined;

function PickChip({ label }: { label: string }) {
  return (
    <p className="glass-tinted inline-flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-sm font-semibold">
      <Star size={13} fill="currentColor" aria-hidden />
      {label}
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
    "pressable flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-base font-semibold whitespace-nowrap outline-white focus-visible:outline-2 focus-visible:outline-offset-2";
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

function PeekRow({ place, trailing }: { place: Place; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-1 pb-4 text-white">
      <PlaceImage
        place={place}
        sizes="56px"
        placeholder={placeColor(place)}
        className="w-14 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          <span className="truncate">{smartQuotes(place.name)}</span>
          {isFavorite(place) && (
            <Star
              size={15}
              fill="currentColor"
              className="shrink-0"
              aria-label={pickLabel(place.pickBy) ?? "Favorite"}
            >
              <title>{pickLabel(place.pickBy) ?? "Favorite"}</title>
            </Star>
          )}
        </h2>
        <p className="flex items-center gap-1.5 truncate text-sm text-white/75">
          <CategoryIcon category={place.category} size={14} className="shrink-0" />
          {placeWhere(place)}
        </p>
      </div>
      {trailing ?? <span className="size-11 shrink-0" />}
    </div>
  );
}

/** The phone map sheet at its smallest: thumbnail, name, and quiet meta. */
export function PlaceSheetHeader({
  place,
  onClose,
  slides,
}: {
  place: Place;
  onClose: () => void;
  slides?: PlaceSlide[];
}) {
  const rows = slides?.length ? slides : [{ place, offset: 0 }];
  return (
    <div className="swipe-track relative">
      {rows.map((slide) => (
        <div
          key={slide.place.id}
          aria-hidden={slide.offset !== 0 || undefined}
          className="swipe-slide"
          data-offset={slide.offset}
          style={
            { "--offset": slide.offset, backgroundColor: placeColor(slide.place) } as React.CSSProperties
          }
        >
          <PeekRow
            place={slide.place}
            trailing={
              slide.offset === 0 ? (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="pressable glass-tinted flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-white focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <X size={20} aria-hidden />
                </button>
              ) : (
                <span className="size-11 shrink-0" />
              )
            }
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The photo for one strip slide. The same element stays mounted when its
 * offset changes, so a swipe never swaps src or fades up from empty.
 * The first time a place opens (not when it slides in from a neighbor) it
 * still plays the sheet's entrance.
 */
function StablePhoto({
  place,
  sizes,
  active,
  alt,
  className,
  fade = false,
}: {
  place: Place;
  sizes: string;
  active: boolean;
  alt: string;
  className?: string;
  fade?: boolean;
}) {
  // Captured once: the place that is open when this slide first mounts fades in.
  // A neighbor that later becomes the open place keeps the element it already painted.
  const [playEntrance] = useState(active);
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={fade ? { maskImage: PHOTO_FADE, WebkitMaskImage: PHOTO_FADE } : undefined}
    >
      <PlaceImage
        place={place}
        alt={active ? alt : ""}
        sizes={sizes}
        priority
        eager
        placeholder={placeColor(place)}
        className={cn("absolute inset-0 aspect-auto", playEntrance && "motion-photo-in")}
      />
      {fade && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent"
        />
      )}
    </div>
  );
}

function slideStyle(place: Place, offset: number): React.CSSProperties {
  return { "--offset": offset, backgroundColor: placeColor(place) } as React.CSSProperties;
}

/** Top right of the phone map sheet, over the photo. */
export function SheetCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute top-2.5 right-3">
      <FloatingButton label="Close" onClick={onClose}>
        <X size={20} aria-hidden />
      </FloatingButton>
    </div>
  );
}

/** What each surface asks next/image for, so a neighbor's photo can be fetched ahead in exactly that size. */
export const PHOTO_SIZES = { sheet: "100vw", rail: "400px", page: "(min-width: 768px) 440px, 100vw" } as const;
const PAGE_PHOTO_SIZES = PHOTO_SIZES.page;

/** How long the outgoing photo stays under the incoming one while it crossfades in. */
const PHOTO_SWAP_MS = 480;
/** The longest a photo waits for its picture before fading in over its placeholder color. */
const PHOTO_WAIT_MS = 600;

/** The photo holds to here, then fades into the color behind it; the blur covers the last 30%. */
const PHOTO_FADE = fadeOutMask(58);

interface PhotoLayer {
  place: Place;
  motion: "in" | "swap" | "slide";
  /** Loaded (or given up waiting), so its fade can start. */
  ready: boolean;
  serial: number;
}

/**
 * The photo at the top of the map sheet and rail, edge to edge, fading into
 * the place's color behind it. Opening plays a scale in + fade in; switching
 * places crossfades the new photo in over the old one once it has loaded.
 */
function PhotoStage({
  place,
  alt,
  sizes,
  replace = false,
  className,
}: {
  place: Place;
  alt: string;
  sizes: string;
  /** The old photo already left with the swipe: the new one fades in on its own instead of over it. */
  replace?: boolean;
  className?: string;
}) {
  const [layers, setLayers] = useState<PhotoLayer[]>([
    { place, motion: "in", ready: !place.image, serial: 0 },
  ]);
  const top = layers[layers.length - 1];
  if (top.place.id !== place.id) {
    // A swipe's photo was fetched ahead, so it slides in at once; a crossfade waits for its picture.
    const incoming: PhotoLayer = {
      place,
      motion: replace ? "slide" : "swap",
      ready: replace || !place.image,
      serial: top.serial + 1,
    };
    setLayers(replace ? [incoming] : [top, incoming]);
  }

  const markReady = (serial: number) =>
    setLayers((current) =>
      current.map((layer) => (layer.serial === serial && !layer.ready ? { ...layer, ready: true } : layer)),
    );

  useEffect(() => {
    if (top.ready) return;
    const timer = window.setTimeout(() => markReady(top.serial), PHOTO_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [top.ready, top.serial]);

  useEffect(() => {
    if (layers.length < 2 || !top.ready) return;
    const timer = window.setTimeout(() => setLayers((current) => current.slice(-1)), PHOTO_SWAP_MS);
    return () => window.clearTimeout(timer);
  }, [layers.length, top.ready]);

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ maskImage: PHOTO_FADE, WebkitMaskImage: PHOTO_FADE }}
    >
      {layers.map((layer) => (
        <PlaceImage
          key={layer.serial}
          place={layer.place}
          alt={layer === top ? alt : ""}
          priority
          sizes={sizes}
          placeholder={placeColor(layer.place)}
          onLoad={() => markReady(layer.serial)}
          className={cn(
            "absolute inset-0 aspect-auto",
            !layer.ready && "opacity-0",
            layer.ready && !(replace && layer.motion === "slide") && `motion-photo-${layer.motion}`,
          )}
        />
      ))}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent"
      />
    </div>
  );
}

interface PlaceDetailProps {
  place: Place;
  onBack: () => void;
  /** Switches to the map with this place in view. */
  onShowOnMap?: () => void;
  /**
   * "page": list mode, full screen. On phones, Apple Music style: the photo
   * runs edge to edge and melts into the page color, with everything else set
   * right on it. On wider screens, a rounded square photo with a soft halo of
   * its colors, and everything else beside it, both starting at the top.
   * "sheet" and "rail": the phone map sheet and the desktop map rail. The photo
   * runs edge to edge on top and fades into the color, then the title with the
   * actions right under it, then the rest; opening staggers them in.
   * All three sit on the place's color; the caller paints it behind them.
   */
  variant: "page" | "rail" | "sheet";
  /** Previous and next place, for the chevrons (wide screens). */
  stepper?: Stepper;
  /** This place was stepped to: it comes in from that side. */
  enterFrom?: StepDirection | null;
  /** Stepped to by a swipe, which already carried the old photo away. */
  swiped?: boolean;
  /** Neighbors kept mounted so a swipe only moves photos that are already painted. */
  slides?: PlaceSlide[];
}

export function PlaceDetail({
  place,
  onBack,
  onShowOnMap,
  variant,
  stepper,
  enterFrom = null,
  swiped = false,
  slides,
}: PlaceDetailProps) {
  const color = placeColor(place);
  const tags = FILTER_TAGS.filter((t) => place.tags.includes(t.id));
  const page = variant === "page";
  // The first place opened plays the full entrance; later ones re-stagger quicker.
  const [firstId] = useState(place.id);
  const [switched, setSwitched] = useState(false);
  if (!switched && place.id !== firstId) setSwitched(true);
  const alt = `${place.name}${place.neighborhood ? ` in ${place.neighborhood}` : ""}, as a grainy film-style picture`;

  const controls = variant !== "sheet" && (
    <div className="pointer-events-none flex items-center justify-between gap-2">
      <FloatingButton label="All places" onClick={onBack}>
        <ChevronLeft size={22} aria-hidden />
      </FloatingButton>
      <div className="flex gap-2">
        {stepper && <StepButtons stepper={stepper} className={cn(page && "hidden md:flex")} />}
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

  const label = pickLabel(place.pickBy);
  const header = (
    <header className="space-y-3 [text-shadow:0_1px_16px_rgb(0_0_0/0.22)]">
      {label && <PickChip label={label} />}
      <h2 className={cn("text-xl font-semibold text-balance", page && "md:text-2xl")}>
        {smartQuotes(place.name)}
      </h2>
      <p className="flex items-center gap-2 text-base font-medium text-white/75">
        <CategoryIcon category={place.category} size={16} />
        {placeWhere(place)}
      </p>
    </header>
  );

  const rows = [
    (place.signatureSubject || tags.length > 0) && (
      <div key="known" className="space-y-4">
        {place.signatureSubject && (
          <div>
            <p className="text-sm font-medium text-white/70">Known for</p>
            <p className="text-lg font-semibold text-pretty">{smartQuotes(place.signatureSubject)}</p>
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
    ),
    place.note && (
      <figure key="note" className="border-l-2 border-white/30 pl-4">
        <blockquote className="text-base">{smartQuotes(place.note)}</blockquote>
        <figcaption className="mt-2 text-sm font-medium text-white/70">{site.hosts}</figcaption>
      </figure>
    ),
    place.summary && (
      <div key="summary">
        <p className="text-base text-white/85">{smartQuotes(place.summary)}</p>
        {place.summarySource === "placeholder" && (
          <p className="mt-2 text-sm text-white/70">A fuller description is on the way.</p>
        )}
      </div>
    ),
    place.address && <CopyAddress key="address" address={place.address} />,
  ].filter(Boolean);

  if (variant === "sheet" || variant === "rail") {
    const rail = variant === "rail";
    const item = (i: number) => ({ className: "motion-item", style: { "--i": i } as React.CSSProperties });
    const article = (
      <article
        aria-label={place.name}
        className="relative text-white"
        data-motion={switched ? "switch" : "open"}
        data-enter={enterSide(enterFrom)}
      >
        <div className="relative">
          <PhotoStage
            place={place}
            alt={alt}
            sizes={rail ? PHOTO_SIZES.rail : PHOTO_SIZES.sheet}
            replace={swiped}
            className={rail ? "aspect-square" : "aspect-[4/3]"}
          />
          <PhotoDissolve color={color} className="h-[30%]" />
          {rail && <div className="absolute inset-x-3 top-3 z-10">{controls}</div>}
        </div>
        <div
          key={place.id}
          className={cn("relative space-y-6 pb-8", rail ? "-mt-20 px-6" : "-mt-16 px-5")}
        >
          <div {...item(0)}>{header}</div>
          <div {...item(1)}>
            <PlaceActions place={place} />
          </div>
          <div className="space-y-8 pt-2">
            {rows.map((row, i) => (
              <div key={i} {...item(i + 2)}>
                {row}
              </div>
            ))}
          </div>
        </div>
      </article>
    );
    if (rail || !slides?.length) return article;
    const sheetAlt = alt;
    return (
      <div className="swipe-track relative min-h-full">
        {slides.map((slide) => {
          const active = slide.offset === 0;
          return (
            <div
              key={slide.place.id}
              aria-hidden={active ? undefined : true}
              className="swipe-slide text-white"
              data-offset={slide.offset}
              style={slideStyle(slide.place, slide.offset)}
            >
              <div className="swipe-photo relative">
                <StablePhoto
                  place={slide.place}
                  sizes={PHOTO_SIZES.sheet}
                  active={active}
                  alt={sheetAlt}
                  fade
                  className="aspect-[4/3]"
                />
                <PhotoDissolve color={placeColor(slide.place)} className="h-[30%]" />
              </div>
              {active ? (
                <div className="relative -mt-16 space-y-6 px-5 pb-8">
                  <div className={cn(!swiped && "motion-item")} style={{ "--i": 0 } as React.CSSProperties}>
                    {header}
                  </div>
                  <div className={cn(!swiped && "motion-item")} style={{ "--i": 1 } as React.CSSProperties}>
                    <PlaceActions place={place} />
                  </div>
                  <div className="space-y-8 pt-2">
                    {rows.map((row, i) => (
                      <div key={i} className={cn(!swiped && "motion-item")} style={{ "--i": i + 2 } as React.CSSProperties}>
                        {row}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="px-5 pt-5 text-lg font-semibold text-white [text-shadow:0_1px_12px_rgb(0_0_0/0.35)]">
                  {smartQuotes(slide.place.name)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <article aria-label={place.name} className="relative min-h-full text-white">
      {/* Phones: floats over the photo and stays in reach while scrolling. Wider screens: a row above the photo. */}
      <div className="sticky top-0 z-20 h-0 md:static md:h-auto">
        <div className="mx-auto max-w-[1144px] px-4 pt-[max(env(safe-area-inset-top),12px)] md:px-10 md:pt-6">
          {controls}
        </div>
      </div>

      {/* Stepping to another place re-keys this, so it comes in with the switch stagger; the first place opens as before. */}
      {slides?.length ? (
        <div className="swipe-track relative md:hidden">
          {slides.map((slide) => {
            const active = slide.offset === 0;
            return (
              <div
                key={slide.place.id}
                aria-hidden={active ? undefined : true}
                className="swipe-slide"
                data-offset={slide.offset}
                style={slideStyle(slide.place, slide.offset)}
              >
                <div className="swipe-photo relative">
                  <StablePhoto
                    place={slide.place}
                    sizes={PAGE_PHOTO_SIZES}
                    active={active}
                    alt={alt}
                    fade
                    className="aspect-square"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/30 to-transparent"
                  />
                  <PhotoDissolve color={placeColor(slide.place)} className="h-2/5" />
                </div>
                {active ? (
                  <div className="relative -mt-20 space-y-6 px-5 pb-36">
                    <div className={cn(switched && !swiped && "motion-item")} style={{ "--i": 0 } as React.CSSProperties}>
                      {header}
                    </div>
                    <div className={cn(switched && !swiped && "motion-item")} style={{ "--i": 1 } as React.CSSProperties}>
                      <PlaceActions place={place} />
                    </div>
                    <div className="space-y-8 pt-4">
                      {rows.map((row, i) => (
                        <div
                          key={i}
                          className={cn(switched && !swiped && "motion-item")}
                          style={{ "--i": i + 2 } as React.CSSProperties}
                        >
                          {row}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="px-5 pt-5 text-lg font-semibold text-white [text-shadow:0_1px_12px_rgb(0_0_0/0.35)]">
                    {smartQuotes(slide.place.name)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
      <div
        key={place.id}
        data-motion={switched ? "switch" : undefined}
        data-enter={enterSide(enterFrom)}
        className="relative mx-auto max-w-[1144px] md:grid md:grid-cols-2 md:items-start md:gap-10 md:px-10 md:pt-8 md:pb-24 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-16 lg:pb-8"
      >
        <div className={cn("relative", switched && !swiped && "motion-photo-swap")}>
          <PhotoHalo place={place} className="hidden md:block" />
          <PlaceImage
            place={place}
            alt={alt}
            priority
            sizes={PAGE_PHOTO_SIZES}
            placeholder={color}
            className="md:rounded-2xl md:shadow-[0_32px_80px_-28px_rgb(0_0_0/0.6)]"
          />
          {/* Phones: a soft shade under the status bar and the floating buttons. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/30 to-transparent md:hidden"
          />
          <PhotoDissolve color={color} className="h-2/5 md:hidden" />
        </div>

        <div className="relative -mt-20 space-y-6 px-5 pb-36 md:mt-0 md:max-w-xl md:space-y-7 md:px-0 md:pb-0">
          <div className={cn(switched && "motion-item")} style={{ "--i": 0 } as React.CSSProperties}>
            {header}
          </div>
          <div className={cn("md:max-w-md", switched && "motion-item")} style={{ "--i": 1 } as React.CSSProperties}>
            <PlaceActions place={place} />
          </div>
          <div className="space-y-8 pt-4">
            {rows.map((row, i) => (
              <div key={i} className={cn(switched && "motion-item")} style={{ "--i": i + 2 } as React.CSSProperties}>
                {row}
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Wide screens keep the List | Map switch floating at the bottom: the page color fades up behind it, so no text sits under it. */}
      <div
        aria-hidden
        className="pointer-events-none sticky bottom-0 hidden h-36 lg:block"
        style={{ backgroundImage: dissolveGradient(color, 55) }}
      />
    </article>
  );
}
