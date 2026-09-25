"use client";

import { Check, ChevronDown, MapPin } from "react-feather";
import { useState } from "react";

import { Bridge } from "@/components/icons/feather-extras";
import { CATEGORY_ICONS } from "@/components/places/category-badge";
import { TagIcon } from "@/components/places/tag-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PlaceFilters } from "@/lib/places/filters";
import { CATEGORIES, FILTER_TAGS } from "@/lib/places/taxonomy";
import type { CategoryId, TagId } from "@/lib/places/types";
import { cn } from "@/lib/utils";
import { ScrollRow } from "./scroll-row";

interface FilterBarProps {
  filters: PlaceFilters;
  onChange: (filters: PlaceFilters) => void;
  /** Neighborhoods with places in the current section and pills, with how many. */
  neighborhoods: { name: string; count: number }[];
  /** Sections that have at least one place; the rest get no tab. */
  categories: Set<CategoryId>;
  /** How many places each pill would leave; pills at zero are disabled. */
  tagCounts: Map<TagId, number>;
  /** Horizontal padding inside both rows, so the first chip lines up with the content below. */
  inset?: string;
  className?: string;
}

/** A chunky toggle chip: white with a crisp outline, inverted to ink when on. */
export function Pill({
  active,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "pressable focus-ring inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
        active
          ? "border-ink bg-ink text-white hover:bg-ink-hover"
          : "border-border bg-surface text-ink hover:border-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** One stop on the category row: a glyph over its label, underlined when selected. */
function CategoryTab({
  icon: TabIcon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group/tab relative flex h-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-1 text-sm font-semibold whitespace-nowrap transition-colors outline-ink select-none focus-visible:outline-2 focus-visible:-outline-offset-2",
        active ? "text-ink" : "text-muted-foreground hover:text-ink",
      )}
    >
      <TabIcon
        size={24}
        className="transition-transform duration-200 ease-snappy group-active/tab:scale-90 motion-reduce:transition-none motion-reduce:group-active/tab:scale-100"
      />
      {label}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-colors",
          active ? "bg-ink" : "bg-transparent group-hover/tab:bg-border",
        )}
      />
    </button>
  );
}

function NeighborhoodPicker({
  value,
  neighborhoods,
  onSelect,
}: {
  value: string | null;
  neighborhoods: { name: string; count: number }[];
  onSelect: (name: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const choose = (name: string | null) => {
    onSelect(name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pill active={value !== null} aria-haspopup="listbox">
          <MapPin size={16} />
          {value ?? "Neighborhood"}
          <ChevronDown size={16} className={cn("-mr-1 transition-transform", open && "rotate-180")} />
        </Pill>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-72 p-2"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div
          role="listbox"
          aria-label="Neighborhoods"
          className="max-h-[min(60vh,440px)] overflow-y-auto"
        >
          {[{ name: null, count: 0 }, ...neighborhoods].map(({ name, count }) => {
            const selected = value === name;
            return (
              <button
                key={name ?? "all"}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(name)}
                className={cn(
                  "focus-ring flex h-12 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-base transition-colors hover:bg-secondary",
                  selected && "bg-secondary",
                )}
              >
                <span className={cn("flex-1 truncate", selected && "font-semibold")}>
                  {name ?? "All neighborhoods"}
                </span>
                {name && (
                  <span className="text-sm text-muted-foreground tabular-nums">{count}</span>
                )}
                <Check size={18} className={selected ? "opacity-100" : "opacity-0"} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar({
  filters,
  onChange,
  neighborhoods,
  categories,
  tagCounts,
  inset,
  className,
}: FilterBarProps) {
  const toggleTag = (tag: TagId) =>
    onChange({
      ...filters,
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    });

  return (
    <div className={className}>
      <ScrollRow label="Category" innerClassName={cn("gap-6 lg:gap-8", inset)}>
        <CategoryTab
          icon={Bridge}
          label="All"
          active={filters.category === null}
          onClick={() => onChange({ ...filters, category: null })}
        />
        {CATEGORIES.filter(
          (c) => categories.has(c.id) || filters.category === c.id,
        ).map((category) => {
          const active = filters.category === category.id;
          return (
            <CategoryTab
              key={category.id}
              icon={CATEGORY_ICONS[category.id]}
              label={category.plural}
              active={active}
              onClick={() => onChange({ ...filters, category: active ? null : category.id })}
            />
          );
        })}
      </ScrollRow>
      <ScrollRow label="More filters" innerClassName={cn("gap-2 pt-4 pb-1", inset)}>
        {(neighborhoods.length > 1 || filters.neighborhood !== null) && (
          <NeighborhoodPicker
            value={filters.neighborhood}
            neighborhoods={neighborhoods}
            onSelect={(neighborhood) => onChange({ ...filters, neighborhood })}
          />
        )}
        {FILTER_TAGS.map((tag) => {
          const active = filters.tags.includes(tag.id);
          return (
            <Pill
              key={tag.id}
              active={active}
              disabled={!active && tagCounts.get(tag.id) === 0}
              onClick={() => toggleTag(tag.id)}
            >
              <TagIcon tag={tag.id} />
              {tag.label}
            </Pill>
          );
        })}
      </ScrollRow>
    </div>
  );
}
