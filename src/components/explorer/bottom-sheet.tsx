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
  /** Floats just above the sheet's top edge and moves with it. */
  accessory?: React.ReactNode;
  /** Identifies what the content shows; each view keeps its own scroll position. */
  scrollKey: string;
  children: React.ReactNode;
  className?: string;
}

const SNAPS: SheetSnap[] = ["full", "mid", "peek"];
const EASE = "transform 420ms cubic-bezier(0.32, 0.72, 0, 1)";

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
  accessory,
  scrollKey,
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
    sheet.style.transition = animate ? EASE : "none";
    sheet.style.transform = `translate3d(0, ${offset}px, 0)`;
  };

  useLayoutEffect(() => {
    if (!drag.current?.moved) moveTo(heights.full - heights[snap], true);
  }, [snap, heights]);

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
        "fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[32px] border-t-[0.5px] border-black/10 bg-white shadow-[0_-16px_48px_-20px_rgb(0_0_0/0.2)] will-change-transform",
        className,
      )}
      style={{ height: heights.full, transform: `translate3d(0, ${offsetFor(snap)}px, 0)` }}
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
      <div className="flex min-h-0 flex-col" style={{ height: heights[snap] }}>
        <div
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
        >
          <div className="flex justify-center pt-2.5 pb-1.5" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-black/15" />
          </div>
          {header}
        </div>
        <div
          ref={contentRef}
          onScroll={(event) =>
            scrollPositions.current.set(scrollKeyRef.current, event.currentTarget.scrollTop)
          }
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
