"use client";

import { useLayoutEffect, useRef } from "react";

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
  children: React.ReactNode;
  className?: string;
}

const SNAPS: SheetSnap[] = ["full", "mid", "peek"];
const CURVE = "420ms cubic-bezier(0.32, 0.72, 0, 1)";
// Switching places eases the glass from one place's color to the next.
const TINT_FADE = "--tint 420ms cubic-bezier(0.22, 1, 0.36, 1)";
// The sheet slides and, between snap points, morphs its inset and corners.
const EASE = [
  ...["transform", "left", "right", "bottom", "border-radius"].map((property) => `${property} ${CURVE}`),
  TINT_FADE,
].join(", ");
export const SHEET_EXIT_MS = 240;
const EXIT = `transform ${SHEET_EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease-out`;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface DragState {
  pointerId: number;
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
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
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

  const moveTo = (offset: number, animate: boolean) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = animate && !prefersReducedMotion() ? EASE : TINT_FADE;
    sheet.style.transform = `translate3d(0, ${offset}px, 0)`;
  };

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
  }, [snap, heights, closing]);

  // Move/up listen on window so a fast drag that leaves the handle keeps tracking,
  // without pointer capture swallowing taps on buttons in the header.
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const downTarget = event.target as HTMLElement;
    const startOffset = offsetFor(snap);
    const d: DragState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset,
      offset: startOffset,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    drag.current = d;

    const move = (e: PointerEvent) => {
      if (e.pointerId !== d.pointerId) return;
      const dy = e.clientY - d.startY;
      if (!d.moved) {
        if (Math.abs(dy) < 6) return;
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
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      drag.current = null;

      if (!d.moved) {
        if (e.type === "pointercancel") return;
        if (downTarget.closest("button, a, input, [role='option']")) return;
        onSnapChange(snap === "peek" ? "mid" : snap === "mid" ? "full" : "mid");
        return;
      }

      // A drag that ends over a header button shouldn't also press it.
      const swallow = (click: MouseEvent) => click.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);

      const projected = d.offset + d.velocity * 200;
      let next = SNAPS.reduce((best, s) =>
        Math.abs(offsetFor(s) - projected) < Math.abs(offsetFor(best) - projected) ? s : best,
      );
      // A confident flick always moves at least one step.
      if (next === snap && Math.abs(d.velocity) > 0.45) {
        const i = SNAPS.indexOf(snap) + (d.velocity > 0 ? 1 : -1);
        next = SNAPS[Math.min(Math.max(i, 0), SNAPS.length - 1)];
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
        "fixed z-20 flex flex-col will-change-transform",
        tint ? "tinted-sheet text-white" : "glass glass-thick",
        closing && "pointer-events-none",
        // Partial heights float inset as a card so the map peeks around them; full height is edge to edge.
        snap === "full"
          ? "inset-x-0 bottom-0 rounded-t-2xl rounded-b-none"
          : "inset-x-2 bottom-2 rounded-2xl",
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
        className="relative flex min-h-0 flex-col overflow-hidden rounded-[inherit]"
        style={{ height: heights[snap] }}
      >
        <div
          className={cn(
            "cursor-grab touch-none select-none active:cursor-grabbing",
            overlay ? "absolute inset-x-0 top-0 z-10 h-14" : "shrink-0",
          )}
          onPointerDown={onPointerDown}
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
            "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            snap !== "peek" && !overlay && (tint ? "border-t border-white/12" : "border-t border-hairline"),
            !footer && "pb-[env(safe-area-inset-bottom)]",
          )}
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
