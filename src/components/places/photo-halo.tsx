import Image from "next/image";

import type { Place } from "@/lib/places/types";
import { cn } from "@/lib/utils";

/**
 * A soft glow of the photo's own colors just around it, over the flat page
 * color. It's drawn from a tiny thumbnail (the one the map pins use), so the
 * softening is mostly the upscale rather than a heavy blur. Place it first
 * inside the photo's relatively positioned wrapper.
 */
export function PhotoHalo({ place, className }: { place: Pick<Place, "image">; className?: string }) {
  if (!place.image) return null;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute -inset-6", className)}>
      <Image
        src={place.image}
        alt=""
        fill
        sizes="96px"
        className="rounded-[40px] object-cover opacity-40 blur-2xl saturate-150"
      />
    </div>
  );
}
