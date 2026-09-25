import Image from "next/image";

import type { Place } from "@/lib/places/types";

const PHOTOS = 5;

/** How colorful a sampled page color is, as the spread of its channels. */
function colorfulness(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...channels) - Math.min(...channels);
}

/**
 * A wash of color behind the list's title: the most colorful of Andy's picks,
 * blurred together and fading into the page before the first row of cards.
 */
export function ListBackdrop({ places }: { places: Place[] }) {
  const photos = places
    .filter((p) => p.andyFavorite && p.image && p.imageColor)
    .sort((a, b) => colorfulness(b.imageColor!) - colorfulness(a.imageColor!) || a.id.localeCompare(b.id))
    .slice(0, PHOTOS);
  if (photos.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -bottom-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
    >
      <div className="absolute -inset-20 flex opacity-90 blur-3xl saturate-200 dark:opacity-70">
        {photos.map((place) => (
          <div key={place.id} className="relative flex-1">
            <Image src={place.image!} alt="" fill sizes="160px" className="object-cover" />
          </div>
        ))}
      </div>
      {/* A veil of the page color keeps the title's contrast whatever the photos are. */}
      <div className="absolute inset-0 bg-canvas/40" />
    </div>
  );
}
