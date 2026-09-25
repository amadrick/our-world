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
 * List | Map segmented control: a glass capsule with an ink thumb that slides
 * to the selected mode. A radio group, so arrow keys move the selection.
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
      className={cn("glass relative grid h-12 grid-cols-2 rounded-full p-1", className)}
    >
      <span
        aria-hidden
        className="glass glass-ink absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-[var(--glass-ease)] motion-reduce:transition-none"
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
              "relative z-10 flex cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-base font-medium transition-colors duration-200",
              "focus-visible:ring-4 focus-visible:ring-black/15 focus-visible:outline-none",
              selected ? "text-white" : "text-foreground hover:text-black/70",
            )}
          >
            <ModeIcon size={17} aria-hidden />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
