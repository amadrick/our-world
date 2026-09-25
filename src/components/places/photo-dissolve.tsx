import { blurLayers, dissolveGradient } from "@/lib/progressive-blur";
import { cn } from "@/lib/utils";

const LAYERS = blurLayers();

/**
 * Laid over the lower part of a hero photo: a blur that ramps up toward the
 * bottom, then the page color gathering over it, so the photo dissolves into
 * the page rather than just fading. Without translucency, only the color runs.
 * On a see-through surface (the glass map sheet) there's no solid color to
 * gather to: leave `color` out and fade the photo itself out beneath the blur.
 */
export function PhotoDissolve({ color, className }: { color?: string; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 bottom-0", className)}>
      <div className="progressive-blur absolute inset-0">
        {LAYERS.map(({ blur, mask }) => (
          <div
            key={blur}
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        ))}
      </div>
      {color && <div className="absolute inset-0" style={{ backgroundImage: dissolveGradient(color) }} />}
    </div>
  );
}
