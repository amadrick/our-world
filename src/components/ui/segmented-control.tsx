"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Icon } from "react-feather";

import { cn } from "@/lib/utils";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: Icon;
}

interface Box {
  left: number;
  right: number;
  top: number;
  height: number;
}

interface Edges {
  left: number;
  right: number;
}

/** The edge heading toward the new segment moves first; the far edge follows a beat behind, so the fill stretches on the way. */
const LEAD_MS = 320;
const TRAIL_MS = 320;
const TRAIL_DELAY_MS = 60;
const TOTAL_MS = Math.max(LEAD_MS, TRAIL_DELAY_MS + TRAIL_MS);
const SAMPLES = 32;

/** CSS cubic-bezier(0.32, 0.72, 0, 1): spring-like with no overshoot, a brisk start and a long soft settle. */
function ease(x: number) {
  const [x1, y1, x2, y2] = [0.32, 0.72, 0, 1];
  const bezier = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, x1, x2) < x) lo = mid;
    else hi = mid;
  }
  return bezier((lo + hi) / 2, y1, y2);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Where the fill's edges are `ms` into a move from one segment to another. */
function edgesAt(from: Edges, to: Edges, ms: number): Edges {
  const lead = ease(clamp01(ms / LEAD_MS));
  const trail = ease(clamp01((ms - TRAIL_DELAY_MS) / TRAIL_MS));
  const forward = to.left + to.right > from.left + from.right;
  const [leftP, rightP] = forward ? [trail, lead] : [lead, trail];
  return {
    left: from.left + (to.left - from.left) * leftP,
    right: from.right + (to.right - from.right) * rightP,
  };
}

/** The fill is two round caps and a strip between them, so its corners stay round however far it stretches. */
function partTransforms({ left, right }: Edges, height: number) {
  return [
    `translateX(${left}px)`,
    `translateX(${left + height / 2}px) scaleX(${Math.max(0, right - left - height)})`,
    `translateX(${right - height}px)`,
  ];
}

function sameBoxes(a: Box[] | null, b: Box[]) {
  return (
    a !== null &&
    a.length === b.length &&
    a.every((box, i) => box.left === b[i].left && box.right === b[i].right && box.top === b[i].top && box.height === b[i].height)
  );
}

/**
 * The one segmented control: a radio group whose selected fill slides from the
 * old segment to the new one, stretching toward it in flight and settling at the
 * new segment's width. The move runs as a transform animation, off the main
 * thread, and the change is reported a frame later, so whatever the choice
 * re-renders can't stall it. Arrow keys move the selection.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  className,
  segmentClassName,
  selectedClassName,
  idleClassName,
  fillClassName,
  thumbClassName,
  iconSize = 18,
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  label: string;
  className?: string;
  segmentClassName?: string;
  /** Text color on the fill. */
  selectedClassName?: string;
  idleClassName?: string;
  /** The fill's color. */
  fillClassName?: string;
  /** Effects on the fill as a whole, e.g. a drop shadow. */
  thumbClassName?: string;
  iconSize?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const parts = useRef<(HTMLSpanElement | null)[]>([]);
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  // What the control shows leads the value by a frame while the move starts.
  const [shown, setShown] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setShown(value);
  }
  const index = segments.findIndex((s) => s.value === shown);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const width = container.clientWidth;
      const next = buttons.current.map((b) =>
        b
          ? { left: b.offsetLeft, right: b.offsetLeft + b.offsetWidth, top: b.offsetTop, height: b.offsetHeight }
          : { left: 0, right: width, top: 0, height: 0 },
      );
      setBoxes((prev) => (sameBoxes(prev, next) ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const b of buttons.current) if (b) observer.observe(b);
    return () => observer.disconnect();
  }, [segments.length]);

  const box = boxes?.[index];
  const flight = useRef<{ from: Edges; to: Edges; index: number; animations: Animation[] } | null>(null);

  useLayoutEffect(() => {
    if (!box) return;
    const to = { left: box.left, right: box.right };
    const previous = flight.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!previous || previous.index === index || reduce) {
      previous?.animations.forEach((a) => a.cancel());
      flight.current = { from: to, to, index, animations: [] };
      return;
    }
    // Interrupted mid-move: start from wherever the fill is now.
    const elapsed = Number(previous.animations[0]?.currentTime ?? TOTAL_MS);
    const from = edgesAt(previous.from, previous.to, elapsed);
    previous.animations.forEach((a) => a.cancel());
    const frames = Array.from({ length: SAMPLES + 1 }, (_, i) => partTransforms(edgesAt(from, to, (i / SAMPLES) * TOTAL_MS), box.height));
    const animations = parts.current.flatMap((part, p) =>
      part ? [part.animate(frames.map((f) => ({ transform: f[p] })), { duration: TOTAL_MS, easing: "linear" })] : [],
    );
    flight.current = { from, to, index, animations };
  }, [box, index]);

  const select = (next: T) => {
    if (next === shown) return;
    setShown(next);
    requestAnimationFrame(() => setTimeout(() => onChange(next)));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + segments.length) % segments.length;
    select(segments[next].value);
    buttons.current[next]?.focus();
  };

  const rest = box ? partTransforms(box, box.height) : null;

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("relative isolate", className)}
    >
      {box && rest && (
        <span
          aria-hidden
          className={cn("pointer-events-none absolute left-0", thumbClassName)}
          style={{ top: box.top, height: box.height }}
        >
          {rest.map((transform, p) => (
            <span
              key={p}
              ref={(el) => {
                parts.current[p] = el;
              }}
              className={cn(
                "absolute top-0 left-0 h-full origin-left will-change-transform",
                p === 1 ? "w-px" : "rounded-full",
                fillClassName,
              )}
              style={{ transform, width: p === 1 ? undefined : box.height }}
            />
          ))}
        </span>
      )}
      {segments.map((segment, i) => {
        const selected = i === index;
        const SegmentIcon = segment.icon;
        return (
          <button
            key={segment.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(segment.value)}
            className={cn(
              "segmented-item relative z-10",
              segmentClassName,
              selected ? selectedClassName : idleClassName,
              // Until the fill is measured (the server render), the selected segment paints it itself.
              selected && !box && cn(fillClassName, thumbClassName),
            )}
          >
            {SegmentIcon && <SegmentIcon size={iconSize} strokeWidth={2.25} className="shrink-0" aria-hidden />}
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
