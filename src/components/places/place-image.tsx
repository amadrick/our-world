"use client";

import Image, { getImageProps } from "next/image";
import { useEffect, useRef } from "react";
import { preload } from "react-dom";

import { CategoryIcon } from "@/components/places/category-badge";
import type { Place } from "@/lib/places/types";
import { cn } from "@/lib/utils";

interface PlaceImageProps {
  place: Pick<Place, "name" | "category" | "image">;
  /** Passed to next/image so each layout downloads an appropriately sized file. */
  sizes: string;
  alt?: string;
  priority?: boolean;
  /** Decode ahead for a neighbor that is mounted but not the open place. */
  eager?: boolean;
  /** Shown while the picture loads; a neutral grey unless the page knows the photo's color. */
  placeholder?: string;
  className?: string;
  imageClassName?: string;
  onLoad?: () => void;
}

/**
 * Starts fetching a place's photo in the size a surface will ask for (the
 * same `sizes`, so the browser picks the same file), so it's ready the moment
 * the place is shown.
 */
function imageRequest(place: Pick<Place, "image">, sizes: string) {
  if (!place.image) return null;
  return getImageProps({ src: place.image, alt: "", fill: true, sizes }).props;
}

export function preloadPlacePhoto(place: Pick<Place, "image">, sizes: string) {
  const props = imageRequest(place, sizes);
  if (!props) return;
  preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "high" });
}

/** Decode the same srcset the surface will paint, so a swipe doesn't wait on a blank frame. */
export function decodePlacePhoto(place: Pick<Place, "image">, sizes: string) {
  const props = imageRequest(place, sizes);
  if (!props || typeof window === "undefined") return;
  const img = new window.Image();
  if (props.srcSet) img.srcset = props.srcSet;
  if (props.sizes) img.sizes = props.sizes;
  img.src = props.src;
  void img.decode?.().catch(() => {});
}

/**
 * The place's picture, or until there is one a sand tile with its category
 * glyph: bare in thumbnails, in a white disc on cards, and captioned at hero size.
 */
export function PlaceImage({
  place,
  sizes,
  alt = "",
  priority,
  eager,
  placeholder,
  className,
  imageClassName,
  onLoad,
}: PlaceImageProps) {
  if (!place.image) {
    return (
      <div
        aria-hidden
        className={cn(
          "dot-grid @container relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden bg-sand text-ink",
          className,
        )}
      >
        <span className="flex items-center justify-center rounded-full @[8rem]:size-14 @[8rem]:bg-surface @[8rem]:shadow-card @[20rem]:size-18">
          <CategoryIcon
            category={place.category}
            size={20}
            className="opacity-70 @[8rem]:size-6 @[8rem]:opacity-100 @[20rem]:size-7"
          />
        </span>
        <span className="hidden text-sm font-medium text-muted-foreground @[20rem]:block">
          Picture coming soon
        </span>
      </div>
    );
  }
  return (
    <LoadedPlaceImage
      place={{ ...place, image: place.image }}
      sizes={sizes}
      alt={alt}
      priority={priority}
      eager={eager}
      placeholder={placeholder}
      className={className}
      imageClassName={imageClassName}
      onLoad={onLoad}
    />
  );
}

function LoadedPlaceImage({
  place,
  sizes,
  alt = "",
  priority,
  eager,
  placeholder,
  className,
  imageClassName,
  onLoad,
}: Omit<PlaceImageProps, "place"> & { place: Pick<Place, "name" | "category"> & { image: string } }) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!priority && !eager) return;
    const img = frame.current?.querySelector("img");
    if (!img?.decode) return;
    void img.decode().catch(() => {});
  }, [place.image, sizes, priority, eager]);
  return (
    <div
      ref={frame}
      className={cn("relative aspect-square overflow-hidden bg-photo", className)}
      style={placeholder ? { backgroundColor: placeholder } : undefined}
      onDragStart={(event) => event.preventDefault()}
    >
      <Image
        src={place.image}
        alt={alt}
        fill
        draggable={false}
        sizes={sizes}
        priority={priority}
        {...(eager && !priority ? { loading: "eager" as const } : {})}
        onLoad={onLoad}
        className={cn("object-cover", imageClassName)}
      />
    </div>
  );
}
