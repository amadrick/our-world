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
  className?: string;
  imageClassName?: string;
}

function monogram(name: string): string {
  return name.replace(/^the\s+/i, "").match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? "·";
}

/** The place's illustration, or a quiet glass tile with its monogram until there is one. */
export function PlaceImage({
  place,
  sizes,
  alt = "",
  priority,
  className,
  imageClassName,
}: PlaceImageProps) {
  if (!place.image) {
    return (
      <div
        aria-hidden
        className={cn(
          "@container relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden",
          "hairline border-black/[0.06] bg-white/45 text-black/45 shadow-[inset_0_1px_0_rgb(255_255_255/0.8)]",
          className,
        )}
      >
        <span className="text-lg font-medium @[8rem]:text-xl">{monogram(place.name)}</span>
        <CategoryIcon category={place.category} size={14} className="hidden @[8rem]:block" />
      </div>
    );
  }
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-white", className)}>
      <Image
        src={place.image}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", imageClassName)}
      />
    </div>
  );
}
