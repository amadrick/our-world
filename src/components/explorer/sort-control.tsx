"use client";

import { SORT_LABELS, SORT_MODES, type SortMode } from "@/lib/places/smart-order";
import { cn } from "@/lib/utils";

/**
 * Smart | A–Z | Nearest: a small glass segmented control beside the count,
 * so any order is one tap away. A radio group, so arrow keys move it.
 */
export function SortControl({
  value,
  onChange,
  className,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
  className?: string;
}) {
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = SORT_MODES.indexOf(value);
    onChange(SORT_MODES[(index + step + SORT_MODES.length) % SORT_MODES.length]);
  };
  return (
    <div
      role="radiogroup"
      aria-label="Order"
      onKeyDown={onKeyDown}
      className={cn("glass-fill flex h-9 shrink-0 items-center rounded-full p-0.5", className)}
    >
      {SORT_MODES.map((mode) => {
        const selected = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(mode)}
            className={cn(
              "focus-ring h-8 cursor-pointer rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200",
              selected ? "bg-ink text-on-ink shadow-[0_1px_4px_rgb(0_0_0/0.2)]" : "text-ink/75 hover:text-ink",
            )}
          >
            {SORT_LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
}
