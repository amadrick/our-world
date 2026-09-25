/**
 * A progressive blur: stacked backdrop-filter layers, each masked to its own
 * band and twice as strong as the one above, so the blur ramps up smoothly
 * toward the bottom instead of switching on at a line.
 */
export interface BlurLayer {
  /** Blur radius in px. */
  blur: number;
  /** CSS mask for the band this layer covers. */
  mask: string;
}

export function blurLayers(count = 7, maxBlur = 48): BlurLayer[] {
  const step = 100 / (count + 1);
  const pct = (n: number) => `${Math.min(100, Math.round(n * step * 100) / 100)}%`;
  return Array.from({ length: count }, (_, i) => {
    const blur = maxBlur / 2 ** (count - 1 - i);
    // The strongest two layers hold to the bottom edge, so the ramp ends fully blurred.
    const mask =
      i >= count - 2
        ? `linear-gradient(to bottom, transparent ${pct(i)}, black ${pct(i + 1)})`
        : `linear-gradient(to bottom, transparent ${pct(i)}, black ${pct(i + 1)}, black ${pct(i + 2)}, transparent ${pct(i + 3)})`;
    return { blur, mask };
  });
}

/** Ease-in opacity stops, so the color gathers slowly and then covers, with no line where it lands. */
const EASE_IN: [at: number, alpha: number][] = [
  [0, 0],
  [20, 0.03],
  [35, 0.1],
  [50, 0.22],
  [64, 0.4],
  [77, 0.62],
  [89, 0.85],
  [100, 1],
];

/** A top-to-bottom gradient from clear to `color` ("#rrggbb"), eased so it has no visible edge. */
export function dissolveGradient(color: string): string {
  const stops = EASE_IN.map(([at, alpha]) => {
    const hex = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return `${color}${hex} ${at}%`;
  });
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}
