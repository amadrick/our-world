import { Eye, Moon, Star, Sun, Sunrise, Sunset } from "react-feather";

import type { TagId } from "@/lib/places/types";

export const TAG_ICONS = {
  "top-pick": Star,
  dinner: Sunset,
  lunch: Sun,
  "late-night": Moon,
  brunch: Sunrise,
  views: Eye,
} satisfies Record<TagId, unknown>;

export function TagIcon({
  tag,
  size = 16,
  className,
}: {
  tag: TagId;
  size?: number;
  className?: string;
}) {
  const Icon = TAG_ICONS[tag];
  return (
    <Icon
      size={size}
      className={className}
      fill={tag === "top-pick" ? "currentColor" : "none"}
      aria-hidden
    />
  );
}
