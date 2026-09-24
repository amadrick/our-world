"use client";

import { Check, ChevronDown, Star } from "react-feather";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PlaceFilters } from "@/lib/places/filters";
import { CATEGORIES, TAGS } from "@/lib/places/taxonomy";
import type { CategoryId, TagId } from "@/lib/places/types";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  filters: PlaceFilters;
  onChange: (filters: PlaceFilters) => void;
  neighborhoods: { name: string; count: number }[];
  /** Only categories and tags that some place uses get a pill. */
  available: { categories: Set<CategoryId>; tags: Set<TagId> };
  /** "wrap" for the desktop panel, "scroll" for chips floating over the map on phones. */
  layout: "wrap" | "scroll";
}

export function Pill({
  active,
  floating = false,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active: boolean; floating?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full hairline px-4 text-base whitespace-nowrap transition-colors duration-150 select-none active:scale-[0.97]",
        "focus-visible:ring-4 focus-visible:ring-black/10 focus-visible:outline-none",
        active
          ? "border-transparent bg-foreground text-white"
          : floating
            ? "border-black/10 bg-white shadow-float"
            : "border-black/15 bg-white hover:bg-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function NeighborhoodPicker({
  value,
  neighborhoods,
  floating,
  onSelect,
}: {
  value: string | null;
  neighborhoods: { name: string; count: number }[];
  floating: boolean;
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
        <Pill active={value !== null} floating={floating} aria-haspopup="listbox">
          {value ?? "Neighborhood"}
          <ChevronDown size={16} className="-mr-1 opacity-60" />
        </Pill>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-64 p-1.5"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div role="listbox" aria-label="Neighborhoods" className="max-h-[min(60vh,420px)] overflow-y-auto">
          {[{ name: null, count: 0 }, ...neighborhoods].map(({ name, count }) => {
            const selected = value === name;
            return (
              <button
                key={name ?? "all"}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(name)}
                className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-2xl px-3 text-left text-base hover:bg-secondary"
              >
                <span className={cn("flex-1 truncate", selected && "font-medium")}>
                  {name ?? "All neighborhoods"}
                </span>
                {name && <span className="text-sm text-muted-foreground tabular-nums">{count}</span>}
                <Check size={16} className={selected ? "opacity-100" : "opacity-0"} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar({ filters, onChange, neighborhoods, available, layout }: FilterBarProps) {
  const floating = layout === "scroll";
  const row = floating
    ? "no-scrollbar scroll-fade-x pointer-events-auto flex gap-2 overflow-x-auto px-3 py-2"
    : "flex flex-wrap gap-2";

  const toggleTag = (tag: TagId) =>
    onChange({
      ...filters,
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    });

  return (
    <div className={cn(!floating && "space-y-2")}>
      <div className={row} role="group" aria-label="Category">
        <Pill
          active={filters.category === null}
          floating={floating}
          onClick={() => onChange({ ...filters, category: null })}
        >
          All
        </Pill>
        {CATEGORIES.filter(
          (c) => available.categories.has(c.id) || filters.category === c.id,
        ).map((category) => {
          const active = filters.category === category.id;
          return (
            <Pill
              key={category.id}
              active={active}
              floating={floating}
              onClick={() => onChange({ ...filters, category: active ? null : category.id })}
            >
              {category.plural}
            </Pill>
          );
        })}
      </div>
      <div className={cn(row, floating && "-mt-2")} role="group" aria-label="More filters">
        {neighborhoods.length > 1 && (
          <NeighborhoodPicker
            value={filters.neighborhood}
            neighborhoods={neighborhoods}
            floating={floating}
            onSelect={(neighborhood) => onChange({ ...filters, neighborhood })}
          />
        )}
        {TAGS.filter((t) => available.tags.has(t.id) || filters.tags.includes(t.id)).map((tag) => {
          const active = filters.tags.includes(tag.id);
          return (
            <Pill key={tag.id} active={active} floating={floating} onClick={() => toggleTag(tag.id)}>
              {tag.id === "top-pick" && <Star size={15} fill="currentColor" />}
              {tag.label}
            </Pill>
          );
        })}
      </div>
    </div>
  );
}
