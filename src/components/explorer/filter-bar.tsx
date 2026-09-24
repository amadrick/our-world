"use client";

import { Check, ChevronDown, MapPin, Star, X } from "lucide-react";
import { useState } from "react";

import { CategoryIcon } from "@/components/places/category-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PlaceFilters } from "@/lib/places/filters";
import { CATEGORIES, TAGS } from "@/lib/places/taxonomy";
import type { TagId } from "@/lib/places/types";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  filters: PlaceFilters;
  onChange: (filters: PlaceFilters) => void;
  neighborhoods: { name: string; count: number }[];
  /** "wrap" for the desktop panel, "scroll" for chips floating over the map on phones. */
  layout: "wrap" | "scroll";
}

function Pill({
  active,
  floating,
  activeColor,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  active: boolean;
  floating: boolean;
  activeColor?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[14px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 select-none active:scale-[0.97] [&_svg]:size-4",
        "focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:outline-none",
        active
          ? "bg-foreground text-white shadow-sm"
          : floating
            ? "bg-white/95 text-foreground shadow-float backdrop-blur hover:bg-white"
            : "bg-secondary text-foreground hover:bg-black/[0.07]",
        className,
      )}
      style={active && activeColor ? { backgroundColor: activeColor } : undefined}
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
          <MapPin />
          {value ?? "Neighborhood"}
          <ChevronDown className="-mr-1 opacity-60" />
        </Pill>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-64 rounded-2xl p-1.5 shadow-panel"
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
                className={cn(
                  "flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-[15px] hover:bg-secondary",
                  selected && "font-semibold",
                )}
              >
                <span className="flex-1 truncate">{name ?? "All neighborhoods"}</span>
                {name && <span className="text-[13px] text-muted-foreground tabular-nums">{count}</span>}
                <Check className={cn("size-4", selected ? "opacity-100" : "opacity-0")} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar({ filters, onChange, neighborhoods, layout }: FilterBarProps) {
  const floating = layout === "scroll";
  const row = floating
    ? "no-scrollbar scroll-fade-x pointer-events-auto flex gap-2 overflow-x-auto px-3 py-1"
    : "flex flex-wrap gap-2";

  const toggleTag = (tag: TagId) =>
    onChange({
      ...filters,
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    });

  return (
    <div className={cn(floating ? "space-y-1" : "space-y-2.5")}>
      <div className={row} role="group" aria-label="Category">
        <Pill
          active={filters.category === null}
          floating={floating}
          onClick={() => onChange({ ...filters, category: null })}
        >
          All
        </Pill>
        {CATEGORIES.map((category) => {
          const active = filters.category === category.id;
          return (
            <Pill
              key={category.id}
              active={active}
              floating={floating}
              activeColor={category.color}
              onClick={() => onChange({ ...filters, category: active ? null : category.id })}
            >
              <span style={active ? undefined : { color: category.color }}>
                <CategoryIcon category={category.id} />
              </span>
              {category.plural}
            </Pill>
          );
        })}
      </div>
      <div className={row} role="group" aria-label="More filters">
        {neighborhoods.length > 1 && (
          <NeighborhoodPicker
            value={filters.neighborhood}
            neighborhoods={neighborhoods}
            floating={floating}
            onSelect={(neighborhood) => onChange({ ...filters, neighborhood })}
          />
        )}
        {TAGS.map((tag) => {
          const active = filters.tags.includes(tag.id);
          return (
            <Pill
              key={tag.id}
              active={active}
              floating={floating}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.id === "andys-pick" && (
                <Star className={cn(active ? "fill-amber-300 text-amber-300" : "fill-amber-400 text-amber-400")} />
              )}
              {tag.label}
              {active && <X className="-mr-1 opacity-70" aria-hidden />}
            </Pill>
          );
        })}
      </div>
    </div>
  );
}
