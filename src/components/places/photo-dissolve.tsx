import { blurLayers, dissolveGradient } from "@/lib/progressive-blur";
import { cn } from "@/lib/utils";

/** A light touch: the photo stays crisp and only its last stretch softens. */
const LAYERS = blurLayers(4, 8);

/**
 * Laid over the bottom of a full-bleed phone photo: a short, light blur that
 * ramps up toward the edge, with the page color gathering over it, so the
 * photo melts into the page. Without translucency, only the color runs.
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
