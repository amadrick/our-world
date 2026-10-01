"use client";

import { List, Map as MapIcon } from "react-feather";

import { SegmentedControl, type Segment } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "map";

const MODES: Segment<ViewMode>[] = [
  { value: "list", label: "List", icon: List },
  { value: "map", label: "Map", icon: MapIcon },
];

/** List | Map segmented control: a glass capsule floating over the content, with an ink fill that slides to the selected mode. */
export function ModeSwitch({
  value,
  onChange,
  className,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}) {
  return (
    <SegmentedControl
      label="View"
      segments={MODES}
      value={value}
      onChange={onChange}
      className={cn(
        "glass grid h-14 w-max grid-cols-2 rounded-full p-1.5 transition-[scale] duration-200 ease-snappy hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100",
        className,
      )}
      segmentClassName="flex items-center justify-center gap-2 rounded-full px-6 text-base font-semibold outline-ink focus-visible:outline-2 focus-visible:outline-offset-2"
      selectedClassName="text-on-ink"
      idleClassName="text-ink/75 hover:text-ink"
      fillClassName="bg-ink"
      thumbClassName="drop-shadow-[0_2px_5px_rgb(0_0_0/0.25)]"
    />
  );
}
