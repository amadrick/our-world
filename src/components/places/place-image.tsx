import Image from "next/image";

import { CategoryIcon } from "@/components/places/category-badge";
import type { Place } from "@/lib/places/types";
import { cn } from "@/lib/utils";

interface PlaceImageProps {
  place: Pick<Place, "name" | "category" | "image">;
  /** Passed to next/image so each layout downloads an appropriately sized file. */
  sizes: string;
  alt?: string;
  priority?: boolean;
  /** Shown while the picture loads; a neutral grey unless the page knows the photo's color. */
  placeholder?: string;
  className?: string;
  imageClassName?: string;
  onLoad?: () => void;
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
    <div
      className={cn("relative aspect-square overflow-hidden bg-photo", className)}
      style={placeholder ? { backgroundColor: placeholder } : undefined}
    >
      <Image
        src={place.image}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={onLoad}
        className={cn("object-cover", imageClassName)}
      />
    </div>
  );
}
