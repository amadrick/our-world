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
        "pressable absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-ink shadow-card hover:shadow-float",
        side === "start"
          ? "left-0 pointer-fine:group-data-[fade-start]/row:flex"
          : "right-0 pointer-fine:group-data-[fade-end]/row:flex",
      )}
    >
      <Icon size={16} strokeWidth={2.5} />
    </button>
  );
}

function syncEdges(wrapper: HTMLElement | null, scroller: HTMLElement | null) {
  if (!wrapper || !scroller) return;
  const max = scroller.scrollWidth - scroller.clientWidth;
  wrapper.toggleAttribute("data-fade-start", scroller.scrollLeft > 1);
  wrapper.toggleAttribute("data-fade-end", scroller.scrollLeft < max - 1);
}

/**
 * A horizontally scrolling row that fades out on whichever side has more to
 * see, with chevron buttons for mouse users. Edges are written to data
 * attributes rather than state, so scrolling never re-renders the row.
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
    <div ref={wrapperRef} className={cn("group/row relative", className)}>
      <div
        ref={scrollerRef}
        role="group"
        aria-label={label}
        onScroll={sync}
        className={cn("no-scrollbar scroll-fade-x flex overflow-x-auto", innerClassName)}
      >
        {children}
      </div>
      <ScrollButton side="start" onClick={() => page(-1)} />
      <ScrollButton side="end" onClick={() => page(1)} />
    </div>
  );
}
