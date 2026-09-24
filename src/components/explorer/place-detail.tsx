"use client";

import { Check, ChevronLeft, Copy, MapPin, Navigation, Star, X } from "lucide-react";
import { useState } from "react";

import { CategoryBadge } from "@/components/places/category-badge";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { appleMapsUrl, googleMapsUrl } from "@/lib/places/links";
import { getCategory, getTag } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";

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
      className="group flex w-full cursor-pointer items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-black/[0.035]"
      aria-label={`Copy address: ${address}`}
    >
      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-[14px] leading-snug">{address}</span>
      <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-muted-foreground">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

interface PlaceDetailProps {
  place: Place;
  onBack: () => void;
  /** Hides the back row when a surrounding header already provides it. */
  showBackRow?: boolean;
}

export function PlaceDetailBackRow({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        onClick={onBack}
        className="-ml-2 h-10 rounded-full px-3 text-[15px] font-medium text-foreground/80"
      >
        <ChevronLeft className="size-5" />
        All places
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="size-9 rounded-full bg-secondary text-foreground/70"
        aria-label="Close"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

export function PlaceDetail({ place, onBack, showBackRow = true }: PlaceDetailProps) {
  const category = getCategory(place.category);
  const pick = place.tags.includes("andys-pick");
  const tags = place.tags.filter((t) => t !== "andys-pick");

  return (
    <article className="@container flex flex-col gap-5" aria-label={place.name}>
      {showBackRow && <PlaceDetailBackRow onBack={onBack} />}

      <header className="space-y-2.5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <CategoryBadge category={place.category} size="sm" />
          <span>
            {category.label}
            {place.neighborhood && ` · ${place.neighborhood}`}
          </span>
        </div>
        <h2 className="font-serif text-[34px] leading-[1.02] tracking-[-0.01em] text-balance">
          {place.name}
        </h2>
        {pick && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {site.host}&apos;s pick
          </span>
        )}
      </header>

      <div className="grid gap-2 @[26rem]:grid-cols-2">
        <Button asChild size="lg" className="h-12 rounded-2xl text-[15px] font-semibold">
          <a href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
            <Navigation className="size-[18px]" />
            Open in Apple Maps
          </a>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="h-12 rounded-2xl border-black/12 text-[15px] font-semibold shadow-none"
        >
          <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
            <MapPin className="size-[18px]" />
            Open in Google Maps
          </a>
        </Button>
      </div>

      {place.note && (
        <figure className="rounded-2xl border border-note-border bg-note px-4 py-3.5">
          <figcaption className="text-[11px] font-semibold tracking-[0.08em] text-note-foreground uppercase">
            {site.host}&apos;s note
          </figcaption>
          <blockquote className="mt-1.5 text-[15px] leading-relaxed text-foreground/90">
            {place.note}
          </blockquote>
        </figure>
      )}

      {place.summary && (
        <section>
          <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            About
          </h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/85">{place.summary}</p>
          {place.summarySource === "placeholder" && (
            <p className="mt-2 text-[12px] text-muted-foreground italic">
              A fuller description is on the way.
            </p>
          )}
        </section>
      )}

      {(place.address || tags.length > 0) && (
        <section className="-mx-3 space-y-3">
          {place.address && <CopyAddress address={place.address} />}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-3 py-1 text-[12px] font-medium text-foreground/75"
                >
                  {getTag(tag).badge}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </article>
  );
}
