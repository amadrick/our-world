"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { OPEN_SHEET_MS, OPEN_TINT_MS, prefersReducedMotion } from "@/lib/motion";
import { lockAxis } from "@/lib/places/swipe";
import { cn } from "@/lib/utils";

export type SheetSnap = "peek" | "mid" | "full";

interface BottomSheetProps {
  snap: SheetSnap;
  /** Visible height of the sheet at each snap point, in pixels. */
  heights: Record<SheetSnap, number>;
  onSnapChange: (snap: SheetSnap) => void;
  /** Always-visible drag area (handle, title row). */
  header: React.ReactNode;
  /** Pinned to the bottom of the visible sheet at every height, e.g. primary actions. */
  footer?: React.ReactNode;
  /** Floats just above the sheet's top edge and moves with it. */
  accessory?: React.ReactNode;
  /** Identifies what the content shows; each view keeps its own scroll position. */
  scrollKey: string;
  /** Tints the glass with this color (a place's), with white text on it. */
  tint?: string;
  /** The handle and header float over the top of the content (e.g. a photo) instead of sitting above it. */
  overlay?: boolean;
  /** Plays the exit: the sheet slides down and fades out, quicker than it came in. The caller unmounts it after SHEET_EXIT_MS. */
  closing?: boolean;
  /** Dragging the half sheet down, or flicking the peek off, closes it. */
  onDismiss?: () => void;
  children: React.ReactNode;
  className?: string;
}

const SNAPS: SheetSnap[] = ["full", "mid", "peek"];
const EASE_SOFT = "cubic-bezier(0.22, 1, 0.36, 1)";
const CURVE = `${OPEN_SHEET_MS}ms ${EASE_SOFT}`;
// The place color eases on the same landing as the camera's wash.
const TINT_FADE = `--tint ${OPEN_TINT_MS}ms ${EASE_SOFT}`;
// The sheet slides and, between snap points, morphs its inset and corners.
const EASE = [
  ...["transform", "left", "right", "bottom", "border-radius"].map((property) => `${property} ${CURVE}`),
  TINT_FADE,
].join(", ");
export const SHEET_EXIT_MS = 240;
const EXIT = `transform ${SHEET_EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease-out`;

function swallowClick(withinMs: number) {
  const swallow = (click: MouseEvent) => click.stopPropagation();
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), withinMs);
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: number;
  offset: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
}

export function BottomSheet({
  snap,
  heights,
  onSnapChange,
  header,
  footer,
  accessory,
  scrollKey,
  tint,
  overlay = false,
  closing = false,
  onDismiss,
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const scrollPositions = useRef(new Map<string, number>());
  const scrollKeyRef = useRef(scrollKey);
  const offsetFor = (s: SheetSnap) => heights.full - heights[s];

  useLayoutEffect(() => {
    scrollKeyRef.current = scrollKey;
    if (contentRef.current) {
      contentRef.current.scrollTop = scrollPositions.current.get(scrollKey) ?? 0;
    }
  }, [scrollKey]);

  const moveTo = useCallback((offset: number, animate: boolean) => {
    const sheet = sheetRef.current;
    const clip = clipRef.current;
    if (!sheet || !clip) return;
    const reduce = prefersReducedMotion();
    sheet.style.transition = animate && !reduce ? EASE : TINT_FADE;
    sheet.style.transform = `translate3d(0, ${offset}px, 0)`;
    // The card grows and shrinks with the drag. Only the clip is painted, so a
    // pull never uncovers a slab of page color below the content.
    const visible = Math.min(heights.full, Math.max(96, heights.full - offset));
    clip.style.transition = animate && !reduce
      ? `height ${OPEN_SHEET_MS}ms ${EASE_SOFT}, border-radius ${OPEN_SHEET_MS}ms ${EASE_SOFT}`
      : "none";
    clip.style.height = `${visible}px`;
  }, [heights]);

  // The first placement slides up from below the screen edge.
  const entered = useRef(false);
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (closing && sheet) {
      sheet.style.transition = prefersReducedMotion() ? "opacity 120ms ease-out" : EXIT;
      sheet.style.transform = `translate3d(0, ${heights.full - heights[snap] + 72}px, 0)`;
      sheet.style.opacity = "0";
      return;
    }
    if (drag.current?.moved) return;
    if (!entered.current) {
      entered.current = true;
      moveTo(heights.full + 24, false);
      void sheetRef.current?.offsetHeight;
    }
    moveTo(heights.full - heights[snap], true);
    // Half and peek show the photo from the top. Scrolling only happens at full height.
    if (snap !== "full" && contentRef.current) contentRef.current.scrollTop = 0;
  }, [snap, heights, closing, moveTo]);

  // At full height, a pull down from the top must drag the sheet, never rubber-band
  // the canvas into view. Below full height the sheet doesn't scroll at all.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    let startY = 0;
    const onStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
    };
    const onMove = (event: TouchEvent) => {
      if (snap !== "full") return;
      const dy = (event.touches[0]?.clientY ?? 0) - startY;
      if (content.scrollTop <= 0 && dy > 0 && event.cancelable) event.preventDefault();
    };
    content.addEventListener("touchstart", onStart, { passive: true });
    content.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      content.removeEventListener("touchstart", onStart);
      content.removeEventListener("touchmove", onMove);
    };
  }, [snap]);

  // Move/up listen on window so a fast drag that leaves the handle keeps tracking,
  // without pointer capture swallowing taps on buttons in the header.
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const downTarget = event.target as HTMLElement;
    // Dragging a photo must move the sheet, not start a native image drag.
    if (downTarget.closest("img")) event.preventDefault();
    const fromContent = contentRef.current?.contains(downTarget) ?? false;
    const scrollTop = contentRef.current?.scrollTop ?? 0;
    const startOffset = offsetFor(snap);
    const d: DragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset,
      offset: startOffset,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    drag.current = d;

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== d.pointerId) return;
      const dy = e.clientY - d.startY;
      if (!d.moved) {
        const axis = lockAxis(e.clientX - d.startX, dy, 6);
        if (!axis) return;
        // Sideways is a swipe between places, not a sheet drag.
        if (axis === "x") {
          stop();
          drag.current = null;
          return;
        }
        // At full height the content scrolls, except a downward pull at the top, which collapses the sheet.
        if (snap === "full" && fromContent && (scrollTop > 0 || dy < 0)) {
          stop();
          drag.current = null;
          return;
        }
        d.moved = true;
      }
      const max = offsetFor("peek");
      let offset = d.startOffset + dy;
      if (offset < 0) offset *= 0.25;
      if (offset > max) offset = max + (offset - max) * 0.25;
      const dt = e.timeStamp - d.lastTime;
      if (dt > 0) d.velocity = 0.8 * ((e.clientY - d.lastY) / dt) + 0.2 * d.velocity;
      d.lastY = e.clientY;
      d.lastTime = e.timeStamp;
      d.offset = offset;
      moveTo(offset, false);
    };

    const end = (e: PointerEvent) => {
      if (e.pointerId !== d.pointerId) return;
      stop();
      drag.current = null;

      if (!d.moved) {
        if (e.type === "pointercancel") return;
        if (downTarget.closest("button, a, input, [role='option']")) return;
        // WebKit's touch adjustment can land the tap's click on the map just above the
        // sheet's edge, where it would close the sheet.
        swallowClick(400);
        onSnapChange(snap === "peek" ? "mid" : snap === "mid" ? "full" : "mid");
        return;
      }

      // A drag that ends over a header button shouldn't also press it.
      swallowClick(0);

      const projected = d.offset + d.velocity * 200;
      let next = SNAPS.reduce((best, s) =>
        Math.abs(offsetFor(s) - projected) < Math.abs(offsetFor(best) - projected) ? s : best,
      );
      // A confident flick always moves at least one step.
      if (next === snap && Math.abs(d.velocity) > 0.45) {
        const i = SNAPS.indexOf(snap) + (d.velocity > 0 ? 1 : -1);
        next = SNAPS[Math.min(Math.max(i, 0), SNAPS.length - 1)];
      }
      // The half sheet drags up to full or down to dismiss. It does not settle into the peek.
      if (snap === "mid" && next === "peek") {
        onDismiss?.();
        return;
      }
      if (snap === "peek" && d.velocity > 0.4 && d.offset > offsetFor("mid")) {
        onDismiss?.();
        return;
      }
      // Full height collapses to half. Dragging it nearly off screen dismisses.
      if (snap === "full" && next === "peek") {
        if (d.offset > offsetFor("peek") + 36) {
          onDismiss?.();
          return;
        }
        next = "mid";
      }
      moveTo(offsetFor(next), true);
      if (next !== snap) onSnapChange(next);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return (
    <div
      ref={sheetRef}
      className={cn(
        "absolute z-20 flex flex-col will-change-transform",
        closing && "pointer-events-none",
        // Partial heights float inset as a card so the map peeks around them; full height is edge to edge.
        snap === "full" ? "inset-x-0 bottom-0" : "inset-x-2 bottom-2",
        className,
      )}
      style={{
        height: heights.full,
        transform: `translate3d(0, ${offsetFor(snap)}px, 0)`,
        ...(tint && { "--tint": tint }),
      }}
    >
      {accessory && (
        <div
          className={cn(
            "absolute right-3 -top-[56px] transition-opacity duration-200",
            snap === "full" && "pointer-events-none opacity-0",
          )}
        >
          {accessory}
        </div>
      )}
      {/* Clips content (a photo edge to edge) to the sheet's rounded corners. */}
      <div
        ref={clipRef}
        data-sheet-clip
        className={cn(
          "relative flex min-h-0 flex-col overflow-hidden",
          tint ? "tinted-sheet text-white" : "glass glass-thick",
          snap === "full" ? "rounded-t-2xl rounded-b-none" : "rounded-2xl",
        )}
        style={{ height: heights[snap], backgroundColor: tint }}
        onPointerDown={onPointerDown}
      >
        <div
          className={cn(
            "cursor-grab touch-none select-none active:cursor-grabbing",
            overlay ? "absolute inset-x-0 top-0 z-10 h-14" : "shrink-0",
          )}
        >
          <div className="flex justify-center pt-2 pb-2" aria-hidden>
            <span
              className={cn(
                "h-1.5 w-10 rounded-full",
                overlay ? "bg-white/80 shadow-[0_1px_4px_rgb(0_0_0/0.3)]" : tint ? "bg-white/35" : "bg-border",
              )}
            />
          </div>
          {header}
        </div>
        <div
          ref={contentRef}
          onScroll={(event) =>
            scrollPositions.current.set(scrollKeyRef.current, event.currentTarget.scrollTop)
          }
          className={cn(
            "min-h-0 flex-1 overscroll-none",
            snap === "full" ? "overlay-scroll-y touch-pan-y" : "touch-none overflow-hidden",
            snap === "peek" && "invisible",
            snap !== "peek" && !overlay && (tint ? "border-t border-white/12" : "border-t border-hairline"),
            !footer && "pb-[env(safe-area-inset-bottom)]",
          )}
          style={tint ? { backgroundColor: tint } : undefined}
        >
          {children}
        </div>
        {footer && (
          <div
            className={cn(
              "shrink-0 border-t px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]",
              tint ? "border-white/12" : "border-hairline",
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
