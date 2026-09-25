import { Calendar, Eye, Moon, Navigation2, Star, Sun, Sunrise, Users } from "react-feather";

import type { TagId } from "@/lib/places/types";

export const TAG_ICONS = {
  "top-pick": Star,
  brunch: Sunrise,
  "late-night": Moon,
  walkable: Navigation2,
  "book-ahead": Calendar,
  views: Eye,
  outdoors: Sun,
  groups: Users,
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
