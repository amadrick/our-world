import {
  Camera,
  Coffee,
  Martini,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { getCategory } from "@/lib/places/taxonomy";
import type { CategoryId } from "@/lib/places/types";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  restaurant: UtensilsCrossed,
  bar: Martini,
  coffee: Coffee,
  activity: Ticket,
  sight: Camera,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: CategoryId;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon className={className} aria-hidden strokeWidth={2.25} />;
}

const SIZES = {
  sm: "size-7 rounded-lg [&_svg]:size-3.5",
  md: "size-10 rounded-xl [&_svg]:size-[18px]",
  lg: "size-12 rounded-2xl [&_svg]:size-[22px]",
};

export function CategoryBadge({
  category,
  size = "md",
  className,
}: {
  category: CategoryId;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { color } = getCategory(category);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color }}
    >
      <CategoryIcon category={category} />
    </span>
  );
}
