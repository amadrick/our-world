"use client";

import {
  Award,
  Check,
  ChevronLeft,
  Copy,
  Map as MapIcon,
  MapPin,
  Navigation,
  Share,
  Star,
  X,
  type Icon,
} from "react-feather";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/places/category-badge";
import { PlaceImage } from "@/components/places/place-image";
import { TagIcon } from "@/components/places/tag-icon";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { appleMapsUrl, googleMapsUrl } from "@/lib/places/links";
import { ANDY_PICK, FILTER_TAGS, getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";

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

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary">
        <MapPin size={22} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium text-muted-foreground">Address</p>
        <p className="text-base font-semibold text-pretty select-text">{address}</p>
      </div>
      <Button
        variant="secondary"
        size="icon"
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
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </Button>
    </div>
  );
}

/** Open in Apple Maps / Google Maps: stacked full width in a panel, side by side in a bottom bar. */
export function PlaceActions({ place, layout }: { place: Place; layout: "stack" | "bar" }) {
  const apple = (
    <a href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
      <Navigation size={18} aria-hidden />
      {layout === "bar" ? "Apple Maps" : "Open in Apple Maps"}
    </a>
  );
  const google = (
    <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
      <MapPin size={18} aria-hidden />
      {layout === "bar" ? "Google Maps" : "Open in Google Maps"}
    </a>
  );
  if (layout === "bar") {
    return (
      <div className="flex gap-3">
        <Button asChild variant="outline" className="h-13 min-w-0 flex-1 px-4">
          {google}
        </Button>
        <Button asChild className="h-13 min-w-0 flex-[1.2] px-4">
          {apple}
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <Button asChild size="lg" className="w-full">
        {apple}
      </Button>
      <Button asChild variant="outline" size="lg" className="w-full">
        {google}
      </Button>
    </div>
  );
}

function Highlight({ icon: HighlightIcon, label, children }: { icon: Icon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary">
        <HighlightIcon size={22} aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-pretty">{children}</p>
      </div>
    </div>
  );
}

function AndyPickBadge() {
  return (
    <p className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary pr-3 pl-2.5 text-sm font-semibold">
      <Star size={13} fill="currentColor" aria-hidden />
      {ANDY_PICK}
    </p>
  );
}

function OverlayBack({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="pressable focus-ring flex h-11 cursor-pointer items-center gap-1 rounded-full bg-surface pr-4 pl-3 text-sm font-semibold shadow-float hover:bg-secondary"
    >
      <ChevronLeft size={20} aria-hidden />
      All places
    </button>
  );
}

function OverlayButton({
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
      className="pressable focus-ring flex size-11 cursor-pointer items-center justify-center rounded-full bg-surface shadow-float hover:bg-secondary"
    >
      {children}
    </button>
  );
}

/** The name and quiet meta shown at the top of the phone map sheet (with a thumbnail when peeking). */
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
    <div className="flex items-center gap-3 px-5 pt-1 pb-4">
      {showThumbnail && (
        <PlaceImage place={place} sizes="56px" className="image-frame w-14 shrink-0 rounded-md" />
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
        <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
          <CategoryIcon category={place.category} size={14} className="shrink-0" />
          {placeWhere(place)}
        </p>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="pressable focus-ring flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-secondary hover:bg-hairline"
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
   * "page": list mode, full screen. The picture sits beside a details panel on
   * wide screens; on phones it stacks, with the actions in a sticky bottom bar.
   * "rail": inside the desktop map rail.
   * "sheet": inside the phone map sheet, whose header shows the name and whose
   * footer holds the actions.
   */
  variant: "page" | "rail" | "sheet";
}

export function PlaceDetail({ place, onBack, onShowOnMap, variant }: PlaceDetailProps) {
  const tags = FILTER_TAGS.filter((t) => place.tags.includes(t.id));
  const page = variant === "page";

  const header = variant !== "sheet" && (
    <header className="space-y-2">
      {place.andyFavorite && <AndyPickBadge />}
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CategoryIcon category={place.category} size={16} />
        {placeWhere(place)}
      </p>
      <h2 className={cn("text-xl font-semibold text-balance", page && "md:text-2xl")}>
        {smartQuotes(place.name)}
      </h2>
    </header>
  );

  const actions = variant !== "sheet" && (
    <div className={cn(page && "hidden md:block")}>
      <PlaceActions place={place} layout="stack" />
    </div>
  );

  const sections = [
    (place.signatureSubject || tags.length > 0 || (variant === "sheet" && place.andyFavorite)) && (
      <div className="space-y-5">
        {place.signatureSubject && (
          <Highlight icon={Award} label="Known for">
            {smartQuotes(place.signatureSubject)}
          </Highlight>
        )}
        {variant === "sheet" && place.andyFavorite && <AndyPickBadge />}
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Good to know">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium"
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
      <figure className="rounded-lg bg-secondary px-5 py-4">
        <blockquote className="text-base">{smartQuotes(place.note)}</blockquote>
        <figcaption className="mt-2 text-sm font-medium text-muted-foreground">
          {site.hosts}
        </figcaption>
      </figure>
    ),
    place.summary && (
      <div>
        <p className="text-base">{smartQuotes(place.summary)}</p>
        {place.summarySource === "placeholder" && (
          <p className="mt-2 text-sm text-muted-foreground">A fuller description is on the way.</p>
        )}
      </div>
    ),
    place.address && <CopyAddress address={place.address} />,
  ].filter(Boolean);

  const body = (
    <div className="flex flex-col">
      {(header || actions) && (
        <div className="flex flex-col gap-6 pb-6">
          {header}
          {actions}
        </div>
      )}
      {sections.map((section, i) => (
        <Fragment key={i}>
          {(i > 0 || header || actions) && <hr className="border-hairline" />}
          <div className="py-6">{section}</div>
        </Fragment>
      ))}
    </div>
  );

  const controls = variant !== "sheet" && (
    <div
      className={cn(
        "flex items-start justify-between gap-2",
        page
          ? "mb-3 md:absolute md:inset-x-3 md:top-3 md:z-10 md:mb-0"
          : "absolute inset-x-3 top-3 z-10",
      )}
    >
      <OverlayBack onBack={onBack} />
      <div className="flex gap-2">
        <OverlayButton label="Share" onClick={() => void sharePlace(place)}>
          <Share size={18} aria-hidden />
        </OverlayButton>
        {onShowOnMap && (
          <OverlayButton label="Show on map" onClick={onShowOnMap}>
            <MapIcon size={18} aria-hidden />
          </OverlayButton>
        )}
      </div>
    </div>
  );

  const picture = (
    <div className={cn("relative", page && "md:sticky md:top-10")}>
      {controls}
      <PlaceImage
        place={place}
        alt={`${place.name}${place.neighborhood ? ` in ${place.neighborhood}` : ""}, as a grainy film-style picture`}
        priority
        sizes={page ? "(min-width: 768px) 480px, 100vw" : "(min-width: 1024px) 376px, 100vw"}
        className={cn(
          "image-frame",
          variant === "rail" ? "aspect-[4/3] rounded-xl" : "aspect-[5/4] rounded-xl",
          page && "aspect-square md:rounded-2xl",
        )}
      />
    </div>
  );

  if (variant === "page") {
    return (
      <article
        aria-label={place.name}
        className="mx-auto max-w-lg px-4 pt-[max(env(safe-area-inset-top),16px)] pb-36 md:grid md:max-w-5xl md:grid-cols-2 md:items-start md:gap-8 md:px-10 md:pt-10 lg:gap-12"
      >
        {picture}
        <div className="mt-4 rounded-2xl border border-hairline bg-surface px-5 pt-6 shadow-card md:mt-0 md:px-8 md:pt-8 md:pb-2">
          {body}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-bar md:hidden">
          <div className="mx-auto max-w-lg">
            <PlaceActions place={place} layout="bar" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article aria-label={place.name} className="flex flex-col gap-5">
      {picture}
      <div className={cn(variant === "rail" ? "px-3" : "px-1")}>{body}</div>
    </article>
  );
}
