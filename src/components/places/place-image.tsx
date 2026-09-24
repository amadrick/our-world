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

/** The clay still of the place's signature, square on white, or a quiet tile until one exists. */
export function PlaceImage({
  place,
  sizes,
  alt = "",
  priority,
  className,
  imageClassName,
}: PlaceImageProps) {
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-white", className)}>
      {place.image ? (
        <Image
          src={place.image}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-black/20">
          <CategoryIcon category={place.category} size={28} />
        </div>
      )}
    </div>
  );
}
