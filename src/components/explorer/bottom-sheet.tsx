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
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const offsetFor = (s: SheetSnap) => heights.full - heights[s];

  const moveTo = (offset: number, animate: boolean) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = animate ? EASE : "none";
    sheet.style.transform = `translate3d(0, ${offset}px, 0)`;
  };

  useLayoutEffect(() => {
    if (!drag.current?.moved) moveTo(heights.full - heights[snap], true);
  }, [snap, heights]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const offset = offsetFor(snap);
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset: offset,
      offset,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const dy = event.clientY - d.startY;
    if (!d.moved) {
      if (Math.abs(dy) < 6) return;
      d.moved = true;
      // Capture only once it's a real drag, so taps still reach buttons in the header.
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    const max = offsetFor("peek");
    let offset = d.startOffset + dy;
    if (offset < 0) offset *= 0.25;
    if (offset > max) offset = max + (offset - max) * 0.25;
    const dt = event.timeStamp - d.lastTime;
    if (dt > 0) d.velocity = 0.8 * ((event.clientY - d.lastY) / dt) + 0.2 * d.velocity;
    d.lastY = event.clientY;
    d.lastTime = event.timeStamp;
    d.offset = offset;
    moveTo(offset, false);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;

    if (!d.moved) {
      const target = event.target as HTMLElement;
      if (target.closest("button, a, input, [role='option']")) return;
      onSnapChange(snap === "peek" ? "mid" : snap === "mid" ? "full" : "mid");
      return;
    }

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

  return (
    <div
      ref={sheetRef}
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] bg-white shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.25),0_-1px_0_rgb(0_0_0/0.04)] will-change-transform",
        className,
      )}
      style={{ height: heights.full, transform: `translate3d(0, ${offsetFor(snap)}px, 0)` }}
    >
      {accessory && (
        <div
          className={cn(
            "absolute right-3 -top-[60px] transition-opacity duration-200",
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
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex justify-center pt-2.5 pb-1.5" aria-hidden>
            <span className="h-[5px] w-10 rounded-full bg-black/15" />
          </div>
          {header}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </div>
    </div>
  );
}
