import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.visualViewport?.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
  };
}

function visibleHeight() {
  const visual = window.visualViewport;
  // Safari's toolbars can overlay the layout viewport; the visual viewport is what is actually on screen.
  // While pinch-zoomed it measures the zoomed region, so fall back to the layout viewport.
  if (!visual || Math.abs(visual.scale - 1) > 0.01) return window.innerHeight;
  return Math.min(window.innerHeight, Math.round(visual.height));
}

/** The height of the part of the viewport on screen, or null before hydration. */
export function useViewportHeight(): number | null {
  return useSyncExternalStore(subscribeResize, visibleHeight, () => null);
}
