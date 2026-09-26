"use client";

import { Check, ChevronDown, MapPin } from "react-feather";
import { useState } from "react";

import { Bridge } from "@/components/icons/feather-extras";
import { CATEGORY_ICONS } from "@/components/places/category-badge";
import { TagIcon } from "@/components/places/tag-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PlaceFilters } from "@/lib/places/filters";
import { CATEGORIES, FILTER_PILLS, getCategory } from "@/lib/places/taxonomy";
import type { CategoryId, PillId } from "@/lib/places/types";
import { cn } from "@/lib/utils";
import { ScrollRow } from "./scroll-row";

interface FilterBarProps {
  filters: PlaceFilters;
  onChange: (filters: PlaceFilters) => void;
  /** Neighborhoods with places in the current section and pills, with how many. */
  neighborhoods: { name: string; count: number }[];
  /** Sections that have at least one place; the rest get no row in the menu. */
  categories: Set<CategoryId>;
  /** How many places each pill would leave; pills at zero are disabled. */
  pillCounts: Map<PillId, number>;
  /** Horizontal padding inside the row, so the first pill lines up with the content below. */
  inset?: string;
  /**
   * Pills floating on the map or on photos (luminous glass). Off when they sit
   * on another glass surface, so two blurs aren't stacked.
   */
  floating?: boolean;
  className?: string;
}

/** A filter pill. Active is ink; resting is luminous glass, or a fill when it sits on glass. */
export function Pill({
  active,
  floating = true,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active: boolean; floating?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "pressable focus-ring inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
        active
          ? "bg-ink text-on-ink shadow-float hover:bg-ink-hover"
          : floating
            ? "glass glass-luminous"
            : "glass-fill text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function MenuRows({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="listbox" aria-label={label} className="overlay-scroll-y max-h-[min(70vh,520px)]">
      {children}
    </div>
  );
}

function MenuOption({
  selected,
  onClick,
  icon,
  label,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "focus-ring flex h-12 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-base transition-colors hover:bg-hover",
        selected && "bg-hover",
      )}
    >
      {icon}
      <span className={cn("flex-1 truncate", selected && "font-semibold")}>{label}</span>
      {count !== undefined && <span className="text-sm text-muted-foreground tabular-nums">{count}</span>}
      <Check size={18} className={selected ? "opacity-100" : "opacity-0"} />
    </button>
  );
}

const menuClass = "glass glass-thick w-64 rounded-2xl bg-(--_tint)! p-2 shadow-none";

/** One category, as a pill. The menu filters the whole guide. */
function CategoryMenu({
  value,
  categories,
  floating,
  onSelect,
}: {
  value: CategoryId | null;
  categories: Set<CategoryId>;
  floating: boolean;
  onSelect: (category: CategoryId | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = value ? getCategory(value) : null;
  const Icon = chosen ? CATEGORY_ICONS[chosen.id] : Bridge;
  const choose = (category: CategoryId | null) => {
    onSelect(category);
    setOpen(false);
  };
  const rows = CATEGORIES.filter((category) => categories.has(category.id) || value === category.id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pill active={value !== null} floating={floating} aria-haspopup="listbox">
          <Icon size={16} />
          {chosen ? chosen.plural : "All"}
          <ChevronDown
            size={16}
            className={cn("-mr-1 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
          />
        </Pill>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={menuClass}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <MenuRows label="Category">
          <MenuOption selected={value === null} onClick={() => choose(null)} icon={<Bridge size={18} />} label="All" />
          {rows.map((category) => {
            const RowIcon = CATEGORY_ICONS[category.id];
            return (
              <MenuOption
                key={category.id}
                selected={value === category.id}
                onClick={() => choose(category.id)}
                icon={<RowIcon size={18} />}
                label={category.plural}
              />
            );
          })}
        </MenuRows>
      </PopoverContent>
    </Popover>
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
          <MapPin size={16} />
          {value ?? "Neighborhood"}
          <ChevronDown
            size={16}
            className={cn("-mr-1 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
          />
        </Pill>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(menuClass, "w-72")}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <MenuRows label="Neighborhoods">
          <MenuOption selected={value === null} onClick={() => choose(null)} label="All neighborhoods" />
          {neighborhoods.map(({ name, count }) => (
            <MenuOption
              key={name}
              selected={value === name}
              onClick={() => choose(name)}
              label={name}
              count={count}
            />
          ))}
        </MenuRows>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar({
  filters,
  onChange,
  neighborhoods,
  categories,
  pillCounts,
  inset,
  floating = true,
  className,
}: FilterBarProps) {
  const togglePill = (pill: PillId) =>
    onChange({
      ...filters,
      pills: filters.pills.includes(pill)
        ? filters.pills.filter((p) => p !== pill)
        : [...filters.pills, pill],
    });

  const [favorites, ...tags] = FILTER_PILLS;
  const pill = ({ id, label }: (typeof FILTER_PILLS)[number]) => {
    const active = filters.pills.includes(id);
    return (
      <Pill
        key={id}
        active={active}
        floating={floating}
        disabled={!active && pillCounts.get(id) === 0}
        onClick={() => togglePill(id)}
      >
        <TagIcon tag={id} />
        {label}
      </Pill>
    );
  };

  return (
    <div className={className}>
      <ScrollRow label="Filters" innerClassName={cn("gap-2 py-1", inset)}>
        <CategoryMenu
          value={filters.category}
          categories={categories}
          floating={floating}
          onSelect={(category) => onChange({ ...filters, category })}
        />
        {pill(favorites)}
        {(neighborhoods.length > 1 || filters.neighborhood !== null) && (
          <NeighborhoodPicker
            value={filters.neighborhood}
            neighborhoods={neighborhoods}
            floating={floating}
            onSelect={(neighborhood) => onChange({ ...filters, neighborhood })}
          />
        )}
        {tags.map(pill)}
      </ScrollRow>
    </div>
  );
}
