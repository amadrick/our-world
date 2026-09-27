"use client";

import { ChevronLeft, ChevronRight } from "react-feather";
import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

function ScrollButton({ side, onClick }: { side: "start" | "end"; onClick: () => void }) {
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      onClick={onClick}
      className={cn(
        "pressable absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full glass text-ink",
        side === "start"
          ? "left-0 pointer-fine:group-data-[more-start]/row:flex"
          : "right-0 pointer-fine:group-data-[more-end]/row:flex",
      )}
    >
      <Icon size={16} strokeWidth={2.5} />
    </button>
  );
}

function syncEdges(wrapper: HTMLElement | null, scroller: HTMLElement | null) {
  if (!wrapper || !scroller) return;
  const max = scroller.scrollWidth - scroller.clientWidth;
  wrapper.toggleAttribute("data-more-start", scroller.scrollLeft > 1);
  wrapper.toggleAttribute("data-more-end", scroller.scrollLeft < max - 1);
}

/**
 * A horizontally scrolling row, with chevron buttons for mouse users on
 * whichever side has more to see. Edges are written to data attributes rather
 * than state, so scrolling never re-renders the row.
 *
 * A horizontal scroller clips vertically too, so it's padded just enough for
 * the children's shadows and pulled back with negative margins. It must take
 * pointer events itself: a scroller with pointer-events: none is never the
 * target of a pan or wheel, even one that starts on a child. No mask either:
 * a masked ancestor would stop the children's backdrop blur at the row.
 */
export function ScrollRow({
  label,
  children,
  className,
  innerClassName,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sync = () => syncEdges(wrapperRef.current, scrollerRef.current);

  // Children can change width (a chosen neighborhood's name), so re-check after every render.
  useLayoutEffect(() => syncEdges(wrapperRef.current, scrollerRef.current));

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(() => syncEdges(wrapper, scroller));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const page = (direction: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollBy({
      left: direction * scroller.clientWidth * 0.7,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <div ref={wrapperRef} className={cn("group/row relative flow-root", className)}>
      <div
        ref={scrollerRef}
        role="group"
        aria-label={label}
        onScroll={sync}
        className={cn(
          "no-scrollbar -mt-2 -mb-3 flex touch-pan-x overflow-x-auto overscroll-x-contain pt-2 pb-3",
          innerClassName,
        )}
      >
        {children}
      </div>
      <ScrollButton side="start" onClick={() => page(-1)} />
      <ScrollButton side="end" onClick={() => page(1)} />
    </div>
  );
}
