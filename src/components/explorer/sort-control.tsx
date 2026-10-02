"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { SORT_LABELS, SORT_MODES, type SortMode } from "@/lib/places/smart-order";
import { cn } from "@/lib/utils";

const SEGMENTS = SORT_MODES.map((mode) => ({ value: mode, label: SORT_LABELS[mode] }));

/** Near you | A–Z: a small glass segmented control beside the count, so any order is one tap away. */
export function SortControl({
  value,
  onChange,
  className,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
  className?: string;
}) {
  return (
    <SegmentedControl
      label="Order"
      segments={SEGMENTS}
      value={value}
      onChange={onChange}
      className={cn("glass-fill flex h-9 shrink-0 items-center rounded-full p-0.5", className)}
      segmentClassName="focus-ring h-8 rounded-full px-3 text-sm font-semibold whitespace-nowrap"
      selectedClassName="text-on-ink"
      idleClassName="text-ink/75 hover:text-ink"
      fillClassName="bg-ink"
      thumbClassName="drop-shadow-[0_1px_2px_rgb(0_0_0/0.22)]"
    />
  );
}
