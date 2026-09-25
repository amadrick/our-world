"use client";

import { List, Map as MapIcon, type Icon } from "react-feather";
import { useRef } from "react";

import { cn } from "@/lib/utils";

export type ViewMode = "list" | "map";

const MODES: { id: ViewMode; label: string; icon: Icon }[] = [
  { id: "list", label: "List", icon: List },
  { id: "map", label: "Map", icon: MapIcon },
];

/**
 * List | Map segmented control: an ink capsule floating over the content, with
 * a white thumb that slides to the selected mode. A radio group, so arrow keys
 * move the selection.
 */
export function ModeSwitch({
  value,
  onChange,
  className,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const index = MODES.findIndex((m) => m.id === value);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + MODES.length) % MODES.length;
    onChange(MODES[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="View"
      onKeyDown={onKeyDown}
      className={cn(
        "relative grid h-14 w-max grid-cols-2 rounded-full bg-ink p-1.5 shadow-[0_8px_28px_-6px_rgb(0_0_0/0.4)] transition-[scale] duration-200 ease-snappy hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] rounded-full bg-surface shadow-[0_2px_8px_rgb(0_0_0/0.3)] transition-transform duration-300 ease-snappy motion-reduce:transition-none"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {MODES.map((mode, i) => {
        const selected = mode.id === value;
        const ModeIcon = mode.icon;
        return (
          <button
            key={mode.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(mode.id)}
            className={cn(
              "pressable relative z-10 flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-base font-semibold outline-white focus-visible:outline-2 focus-visible:outline-offset-2",
              selected ? "text-ink" : "text-white/75 hover:text-white",
            )}
          >
            <ModeIcon size={18} strokeWidth={2.25} className="shrink-0" aria-hidden />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
