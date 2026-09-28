"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";
import { flushSync } from "react-dom";

import { endGesture, gestureAxis } from "@/lib/gesture-axis";
import { settleDuration } from "@/lib/map/swipe-camera";
import { swipeOffset, swipeOutcome, type StepDirection } from "@/lib/places/swipe";

/** Velocity is measured over the last stretch of the drag, ms. */
const VELOCITY_WINDOW = 100;

interface SwipeOptions {
  enabled: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onStep: (direction: StepDirection) => void;
  /**
   * The drag's progress toward a neighbor, every move: `direction` is where the
   * card is headed, `p` the share of a page it has covered (rubber-banded past the
   * last ready neighbor), `open` whether that neighbor can be swiped to.
   */
  onDrag?: (direction: StepDirection, p: number, open: boolean) => void;
  /** Let go: the rest of the way (`to` 1 commits, 0 goes back) takes `durationMs`, on the shared curve. */
  onRelease?: (direction: StepDirection, to: 0 | 1, durationMs: number) => void;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Horizontal swipes on `ref` step to the next or previous place. The gesture
 * locks to one axis first, so vertical scrolling and the sheet's own drag
 * never turn into a step. While dragging, --swipe-x follows the finger and a
 * `.swipe-track` inside translates by it, with the neighbors parked just off
 * either side. data-swipe ("drag", "back", "out") times the settle. Scrollable
 * areas inside need `touch-action: pan-y` so a
 * horizontal drag reaches here instead of starting a browser pan.
 */
export function useSwipeBetween(
  ref: RefObject<HTMLElement | null>,
  { enabled, hasPrev, hasNext, onStep, onDrag, onRelease }: SwipeOptions,
) {
  const neighbors = useEffectEvent(() => ({ hasPrev, hasNext }));
  const step = useEffectEvent((direction: StepDirection) => onStep(direction));
  const dragged = useEffectEvent((direction: StepDirection, p: number, open: boolean) => onDrag?.(direction, p, open));
  const released = useEffectEvent((direction: StepDirection, to: 0 | 1, ms: number) => onRelease?.(direction, to, ms));

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let timer = 0;

    const show = (x: number) => {
      el.style.setProperty("--swipe-x", `${x}px`);
    };
    const reset = () => {
      el.removeAttribute("data-swipe");
      el.style.removeProperty("--swipe-x");
      el.style.removeProperty("--swipe-ms");
    };

    // The card and the map share one curve and one duration, scaled by what's left of the page.
    const settle = (direction: StepDirection | 0, width: number, toward: StepDirection, covered: number) => {
      const reduced = reducedMotion();
      if (direction === 0) {
        const ms = settleDuration(covered);
        released(toward, 0, reduced ? 0 : ms);
        if (reduced) return reset();
        el.style.setProperty("--swipe-ms", `${ms}ms`);
        el.dataset.swipe = "back";
        void el.offsetWidth;
        show(0);
        timer = window.setTimeout(reset, ms);
        return;
      }
      // Page the track fully across, then swap. The neighbor page is already
      // where the new place's page lands, so the commit doesn't flash a gap.
      const commit = () => {
        flushSync(() => step(direction));
        reset();
      };
      const ms = settleDuration(1 - (toward === direction ? covered : 0));
      released(direction, 1, reduced ? 0 : ms);
      if (reduced) return commit();
      el.style.setProperty("--swipe-ms", `${ms}ms`);
      el.dataset.swipe = "out";
      void el.offsetWidth;
      show(-direction * width);
      timer = window.setTimeout(commit, ms);
    };

    const onPointerDown = (down: PointerEvent) => {
      if (down.pointerType === "mouse" && down.button !== 0) return;
      if (el.dataset.swipe === "out") return;
      if ((down.target as HTMLElement).closest("[data-no-swipe], input, textarea, select")) return;
      // A native image drag cancels the pointer, so the swipe never gets a move.
      if ((down.target as HTMLElement).closest("img")) down.preventDefault();
      const track = el.querySelector(".swipe-track");
      const gap = track instanceof HTMLElement ? parseFloat(getComputedStyle(track).getPropertyValue("--swipe-gap")) || 0 : 0;
      // One page is a page's width plus the gap to the next.
      const width = ((track instanceof HTMLElement && track.clientWidth) || el.clientWidth || window.innerWidth) + gap;
      const g = {
        axis: null as "x" | "y" | null,
        dx: 0,
        toward: 1 as StepDirection,
        covered: 0,
        samples: [[down.timeStamp, down.clientX]] as [time: number, x: number][],
      };

      const stop = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
      };
      const onMove = (move: PointerEvent) => {
        if (move.pointerId !== down.pointerId) return;
        const dx = move.clientX - down.clientX;
        if (!g.axis) {
          // Decided once per touch, with the sheet's drag, so only one of them ever moves.
          g.axis = gestureAxis(down.pointerId, dx, move.clientY - down.clientY);
          if (g.axis === "y") return stop();
          if (!g.axis) return;
          window.clearTimeout(timer);
          el.dataset.swipe = "drag";
        }
        g.dx = dx;
        g.samples.push([move.timeStamp, move.clientX]);
        while (g.samples.length > 2 && move.timeStamp - g.samples[0][0] > VELOCITY_WINDOW) g.samples.shift();
        const { hasPrev: prev, hasNext: next } = neighbors();
        const offset = swipeOffset(dx, width, prev, next);
        show(offset);
        // Left is toward the next place.
        const toward: StepDirection = offset < 0 ? 1 : -1;
        g.toward = toward;
        g.covered = Math.min(Math.abs(offset) / width, 1);
        if (!reducedMotion()) dragged(toward, g.covered, toward === 1 ? next : prev);
      };
      const onEnd = (end: PointerEvent) => {
        if (end.pointerId !== down.pointerId) return;
        stop();
        endGesture(down.pointerId);
        if (g.axis !== "x") return;
        // A swipe that ends over a button or link shouldn't also press it.
        const swallow = (click: MouseEvent) => {
          click.stopPropagation();
          click.preventDefault();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);

        const [t0, x0] = g.samples[0];
        const [t1, x1] = g.samples[g.samples.length - 1];
        const velocity = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
        const { hasPrev: prev, hasNext: next } = neighbors();
        const direction =
          end.type === "pointercancel"
            ? 0
            : swipeOutcome({ dx: g.dx, velocity, width, hasPrev: prev, hasNext: next });
        settle(direction, width, g.toward, g.covered);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    };

    el.addEventListener("pointerdown", onPointerDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.clearTimeout(timer);
      reset();
    };
  }, [ref, enabled]);
}
