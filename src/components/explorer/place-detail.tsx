"use client";

import { Check, ChevronLeft, Copy, MapPin, Navigation, Star } from "react-feather";
import { useState } from "react";

import { CategoryIcon } from "@/components/places/category-badge";
import { PlaceImage } from "@/components/places/place-image";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { appleMapsUrl, googleMapsUrl } from "@/lib/places/links";
import { getCategory, getTag } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard access can be blocked; the address is still selectable.
        }
      }}
      className="flex w-full cursor-pointer items-start gap-3 rounded-[20px] p-3 text-left transition-colors hover:bg-white/45"
      aria-label={`Copy address: ${address}`}
    >
      <MapPin size={16} className="text-muted-foreground mt-1 shrink-0" />
      <span className="flex-1 text-base">{address}</span>
      <span className="text-muted-foreground mt-0.5 flex shrink-0 items-center gap-1 text-sm">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

export function PlaceDetailBackRow({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" onClick={onBack} className="-ml-3 h-10 self-start px-3">
      <ChevronLeft size={20} />
      All places
    </Button>
  );
}

/** Floats over the hero image: clear glass, since the illustration behind is the content. */
function BackOverImage({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="glass glass-clear glass-interactive absolute top-3 left-3 flex h-9 items-center gap-1 rounded-full pr-3.5 pl-2 text-sm font-medium"
    >
      <ChevronLeft size={18} />
      All places
    </button>
  );
}

interface PlaceDetailProps {
  place: Place;
  onBack: () => void;
  /** Hides the back control when a surrounding header already provides it. */
  showBackRow?: boolean;
  /** Extra inset for everything below the image (the image sits closer to the edge). */
  bodyClassName?: string;
}

export function PlaceDetail({
  place,
  onBack,
  showBackRow = true,
  bodyClassName,
}: PlaceDetailProps) {
  const pick = place.tags.includes("top-pick");
  const tags = place.tags.filter((t) => t !== "top-pick");

  return (
    <article className="@container flex flex-col gap-6" aria-label={place.name}>
      <div className="relative">
        <PlaceImage
          place={place}
          alt={`Clay-model illustration of ${place.name}`}
          priority
          sizes="(min-width: 1024px) 376px, 100vw"
          className="aspect-[16/10] rounded-[20px]"
        />
        {showBackRow && <BackOverImage onBack={onBack} />}
      </div>

      <div className={cn("flex flex-col gap-6", bodyClassName)}>
        <header className="space-y-2">
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <CategoryIcon category={place.category} size={14} />
            {getCategory(place.category).label}
            {place.neighborhood && ` · ${place.neighborhood}`}
          </p>
          <h2 className="text-xl font-medium text-balance">{smartQuotes(place.name)}</h2>
          {pick && (
            <p className="flex items-center gap-1.5 text-sm">
              <Star size={13} fill="currentColor" />
              Top pick
            </p>
          )}
        </header>

        <div className="grid gap-2 @[26rem]:grid-cols-2">
          <Button asChild size="lg">
            <a href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
              <Navigation size={17} />
              Open in Apple Maps
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
              <MapPin size={17} />
              Open in Google Maps
            </a>
          </Button>
        </div>

        {place.note && (
          <figure className="rounded-[20px] bg-white/45 px-5 py-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]">
            <blockquote className="text-base">{smartQuotes(place.note)}</blockquote>
            <figcaption className="text-muted-foreground mt-2 text-sm">{site.hosts}</figcaption>
          </figure>
        )}

        {place.summary && (
          <div>
            <p className="text-foreground/80 text-base">{smartQuotes(place.summary)}</p>
            {place.summarySource === "placeholder" && (
              <p className="text-muted-foreground mt-2 text-sm">
                A fuller description is on the way.
              </p>
            )}
          </div>
        )}

        {(place.address || tags.length > 0) && (
          <div className="-mx-3 space-y-3">
            {place.address && <CopyAddress address={place.address} />}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="hairline text-muted-foreground rounded-full border-black/10 bg-white/40 px-3 py-1 text-sm"
                  >
                    {getTag(tag).badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
