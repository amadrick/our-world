"use client";

import { Bookmark } from "react-feather";
import { useState } from "react";

import { toggleSaved, useIsSaved } from "@/hooks/use-saved-places";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";
import { cn } from "@/lib/utils";

/**
 * The guest's own bookmark for a place, on the place's color. Resting it is the
 * tinted glass of the other controls there; saved it turns solid white with a
 * filled bookmark, so it can't be mistaken for the couple's pick star.
 */
export function SaveToggle({ place, className }: { place: Place; className?: string }) {
  const saved = useIsSaved(place.id);
  // Bumped on each save so the pop replays; unsaving just settles back.
  const [pops, setPops] = useState(0);
  const name = smartQuotes(place.name);

  return (
    <button
      type="button"
      aria-label={saved ? "Saved" : `Save ${name}`}
      title={saved ? `Saved · tap to remove ${name}` : `Save ${name}`}
      data-saved={saved || undefined}
      onClick={() => {
        if (!saved) {
          setPops((n) => n + 1);
          navigator.vibrate?.(8);
        }
        toggleSaved(place.id);
      }}
      className={cn(
        "pressable relative flex size-11 shrink-0 items-center justify-center rounded-full outline-white focus-visible:outline-2 focus-visible:outline-offset-2 [text-shadow:none]",
        saved ? "bg-white text-[#141414] shadow-[0_4px_14px_-4px_rgb(0_0_0/0.35)]" : "glass-tinted hover:bg-white/20",
        className,
      )}
    >
      <Bookmark
        key={pops}
        size={18}
        strokeWidth={2.2}
        fill={saved ? "currentColor" : "none"}
        className={cn(pops > 0 && saved && "save-pop")}
        aria-hidden
      />
      {pops > 0 && saved && <span key={`ring-${pops}`} aria-hidden className="save-ring" />}
    </button>
  );
}
