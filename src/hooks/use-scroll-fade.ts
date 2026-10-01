import { useEffect, useLayoutEffect, type RefObject } from "react";

/** How deep the fade at a scroll edge gets, px. */
export const SCROLL_FADE_PX = 28;

function setPx(el: HTMLElement, name: string, value: number) {
  const next = `${value}px`;
  if (el.style.getPropertyValue(name) !== next) el.style.setProperty(name, next);
}

/**
 * Writes how far content runs past each edge of a scroller, capped at
 * SCROLL_FADE_PX, to --fade-start and --fade-end. The fade utilities size their
 * masks from these, so a fade only shows once something is under that edge and
 * grows in with the first few pixels of scroll.
 */
export function syncScrollFade(el: HTMLElement, axis: "x" | "y" = "y") {
  const position = axis === "y" ? el.scrollTop : el.scrollLeft;
  const max = axis === "y" ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
  const clamp = (n: number) => Math.round(Math.min(SCROLL_FADE_PX, Math.max(0, n)));
  setPx(el, "--fade-start", clamp(position));
  setPx(el, "--fade-end", clamp(max - position));
}

/** No fade at either edge, for a scroller that isn't scrolling right now. */
export function clearScrollFade(el: HTMLElement) {
  setPx(el, "--fade-start", 0);
  setPx(el, "--fade-end", 0);
}

/** Keeps a vertical scroller's --fade-start and --fade-end current (pair with scroll-fade-y). */
export function useScrollFade(ref: RefObject<HTMLElement | null>, enabled = true) {
  // Content can change length on any render (filters, a new place), so re-check after each one.
  useLayoutEffect(() => {
    if (enabled && ref.current) syncScrollFade(ref.current);
  });

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const sync = () => syncScrollFade(el);
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [ref, enabled]);
}
