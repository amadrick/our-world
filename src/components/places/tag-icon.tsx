import { Eye, Moon, Star, Sun, Sunrise, Sunset } from "react-feather";

import type { PillId } from "@/lib/places/types";

export const TAG_ICONS = {
  favorites: Star,
  dinner: Sunset,
  lunch: Sun,
  "late-night": Moon,
  brunch: Sunrise,
  views: Eye,
} satisfies Record<PillId, unknown>;

export function TagIcon({
  tag,
  size = 16,
  className,
}: {
  tag: PillId;
  size?: number;
  className?: string;
}) {
  const Icon = TAG_ICONS[tag];
  return (
    <Icon
      size={size}
      className={className}
      fill={tag === "favorites" ? "currentColor" : "none"}
      aria-hidden
    />
  );
}
