import { shade } from "@/lib/images/palette.mjs";
import { isFavorite } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";

/** Where each glow sits and how far it reaches (ellipse radii), left to right across the top. */
const GLOWS = [
  { at: "8% 0%", size: "48% 88%" },
  { at: "50% -12%", size: "44% 80%" },
  { at: "94% 4%", size: "46% 86%" },
];

/** Opacity falls off along an ease-out curve, so a glow has no rim where it ends. */
const FALLOFF: [at: number, share: number][] = [
  [0, 1],
  [22, 0.72],
  [42, 0.42],
  [60, 0.2],
  [76, 0.07],
  [90, 0.015],
  [100, 0],
];

function hue(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const colorfulness = (hex: string) => {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...channels) - Math.min(...channels);
};

/** Andy's most colorful picks, one per hue family, so the glows don't repeat a color. */
function glowColors(places: Place[]): string[] {
  const candidates = places
    .filter((p) => isFavorite(p) && p.imageColor)
    .map((p) => p.imageColor!)
    .sort((a, b) => colorfulness(b) - colorfulness(a) || a.localeCompare(b));
  const picked: string[] = [];
  for (const color of candidates) {
    const apart = picked.every((p) => {
      const d = Math.abs(hue(p) - hue(color)) % 360;
      return Math.min(d, 360 - d) > 50;
    });
    if (apart) picked.push(color);
    if (picked.length === GLOWS.length) break;
  }
  return picked;
}

function glows(colors: string[], lightness: number, chroma: number, alpha: number) {
  return colors
    .map((color, i) => {
      const tint = shade(color, lightness, chroma);
      const stops = FALLOFF.map(([at, share]) => {
        const a = Math.round(alpha * share * 255).toString(16).padStart(2, "0");
        return `${tint}${a} ${at}%`;
      });
      return `radial-gradient(${GLOWS[i].size} at ${GLOWS[i].at}, ${stops.join(", ")})`;
    })
    .join(", ");
}

/**
 * A faint glow of color behind the list's title, taken from the photos of
 * Andy's picks: pale on the light page, deep on the dark one, and gone well
 * before the first row of cards.
 */
export function ListBackdrop({ places }: { places: Place[] }) {
  const colors = glowColors(places);
  if (colors.length === 0) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%+10rem)]">
      <div className="absolute inset-0 dark:hidden" style={{ backgroundImage: glows(colors, 0.9, 0.7, 0.5) }} />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{ backgroundImage: glows(colors, 0.3, 0.9, 0.45) }}
      />
    </div>
  );
}
