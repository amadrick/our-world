import { Camera, Coffee, Compass } from "react-feather";

import { Cocktail, Utensils } from "@/components/icons/feather-extras";
import type { CategoryId } from "@/lib/places/types";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS = {
  restaurant: Utensils,
  bar: Cocktail,
  coffee: Coffee,
  activity: Compass,
  sight: Camera,
} satisfies Record<CategoryId, unknown>;

export function CategoryIcon({
  category,
  size = 18,
  className,
}: {
  category: CategoryId;
  size?: number;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon size={size} className={className} aria-hidden />;
}

export function CategoryBadge({
  category,
  size = "md",
  className,
}: {
  category: CategoryId;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-secondary text-foreground",
        size === "sm" ? "size-8 rounded-[10px]" : "size-11 rounded-[14px]",
        className,
      )}
    >
      <CategoryIcon category={category} size={size === "sm" ? 15 : 18} />
    </span>
  );
}
