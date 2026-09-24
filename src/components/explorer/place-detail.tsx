"use client";

import { Check, ChevronLeft, Copy, MapPin, Navigation, Star } from "react-feather";
import { useState } from "react";

import { CategoryIcon } from "@/components/places/category-badge";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { appleMapsUrl, googleMapsUrl } from "@/lib/places/links";
import { getCategory, getTag } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";

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
      className="flex w-full cursor-pointer items-start gap-3 rounded-[20px] p-3 text-left transition-colors hover:bg-secondary/70"
      aria-label={`Copy address: ${address}`}
    >
      <MapPin size={16} className="mt-1 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-base">{address}</span>
      <span className="mt-0.5 flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
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

interface PlaceDetailProps {
  place: Place;
  onBack: () => void;
  /** Hides the back row when a surrounding header already provides it. */
  showBackRow?: boolean;
}

export function PlaceDetail({ place, onBack, showBackRow = true }: PlaceDetailProps) {
  const pick = place.tags.includes("top-pick");
  const tags = place.tags.filter((t) => t !== "top-pick");

  return (
    <article className="@container flex flex-col gap-6" aria-label={place.name}>
      {showBackRow && <PlaceDetailBackRow onBack={onBack} />}

      <header className="space-y-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
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
        <figure className="rounded-[24px] bg-secondary px-5 py-4">
          <blockquote className="text-base">{smartQuotes(place.note)}</blockquote>
          <figcaption className="mt-2 text-sm text-muted-foreground">{site.hosts}</figcaption>
        </figure>
      )}

      {place.summary && (
        <div>
          <p className="text-base text-foreground/80">{smartQuotes(place.summary)}</p>
          {place.summarySource === "placeholder" && (
            <p className="mt-2 text-sm text-muted-foreground">A fuller description is on the way.</p>
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
                  className="rounded-full hairline border-black/15 px-3 py-1 text-sm text-muted-foreground"
                >
                  {getTag(tag).badge}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
