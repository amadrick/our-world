import { describe, expect, it } from "vitest";

import {
  EMPTY_FILTERS,
  filterPlaces,
  matchesInOtherSections,
  neighborhoodCounts,
  sortPlaces,
  tagCounts,
} from "./filters";
import { FILTER_TAGS } from "./taxonomy";
import type { Place } from "./types";

const place = (id: string, overrides: Partial<Place> = {}): Place => ({
  id,
  name: id,
  category: "restaurant",
  neighborhood: "Mission",
  address: "",
  lat: 37.76,
  lng: -122.42,
  tags: [],
  summary: "",
  summarySource: "written",
  createdAt: "2026-09-24T00:00:00.000Z",
  ...overrides,
});

const places = [
  place("zuni", { neighborhood: "Hayes Valley", tags: ["top-pick", "dinner", "lunch"] }),
  place("trick-dog", { category: "bar", tags: ["top-pick", "dinner", "late-night"] }),
  place("la-taqueria", { tags: ["lunch"] }),
  place("ocean-beach", { category: "park", neighborhood: "Outer Sunset", tags: ["views"] }),
];
const pills = FILTER_TAGS.map((t) => t.id);
const ids = (f: Partial<typeof EMPTY_FILTERS>) =>
  filterPlaces(places, { ...EMPTY_FILTERS, ...f }).map((p) => p.id);

describe("filterPlaces", () => {
  it("returns everything with no filters", () => {
    expect(filterPlaces(places, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("combines a section, a neighborhood, and pills", () => {
    expect(ids({ category: "bar" })).toEqual(["trick-dog"]);
    expect(ids({ category: "park" })).toEqual(["ocean-beach"]);
    expect(ids({ neighborhood: "Mission" })).toEqual(["trick-dog", "la-taqueria"]);
    expect(ids({ tags: ["dinner"] })).toEqual(["zuni", "trick-dog"]);
    expect(ids({ tags: ["dinner", "late-night"] })).toEqual(["trick-dog"]);
    expect(ids({ category: "bar", tags: ["late-night"] })).toEqual(["trick-dog"]);
    expect(ids({ category: "restaurant", tags: ["late-night"] })).toEqual([]);
  });
});

describe("tagCounts", () => {
  it("counts what each pill would leave across every section", () => {
    const counts = tagCounts(places, EMPTY_FILTERS, pills);
    expect(Object.fromEntries(counts)).toEqual({
      dinner: 2,
      lunch: 2,
      "late-night": 1,
      brunch: 0,
      views: 1,
    });
  });

  it("scopes the counts to the chosen section, so pills with nothing there read zero", () => {
    const counts = tagCounts(places, { ...EMPTY_FILTERS, category: "park" }, pills);
    expect([...counts].filter(([, n]) => n > 0).map(([tag]) => tag)).toEqual(["views"]);
  });

  it("gives an active pill the current count and narrows the others", () => {
    const counts = tagCounts(places, { ...EMPTY_FILTERS, tags: ["dinner"] }, pills);
    expect(counts.get("dinner")).toBe(2);
    expect(counts.get("late-night")).toBe(1);
    expect(counts.get("lunch")).toBe(1);
    expect(counts.get("views")).toBe(0);
  });
});

describe("matchesInOtherSections", () => {
  it("counts matches elsewhere when a section is empty for the chosen pills", () => {
    const filters = { ...EMPTY_FILTERS, category: "park" as const, tags: ["late-night" as const] };
    expect(filterPlaces(places, filters)).toEqual([]);
    expect(matchesInOtherSections(places, filters)).toBe(1);
  });

  it("is zero without both a section and a pill", () => {
    expect(matchesInOtherSections(places, { ...EMPTY_FILTERS, category: "park" })).toBe(0);
    expect(matchesInOtherSections(places, { ...EMPTY_FILTERS, tags: ["dinner"] })).toBe(0);
  });
});

describe("neighborhoodCounts", () => {
  it("counts only the places it is given, so it can follow the section and pills", () => {
    expect(neighborhoodCounts(ids({ tags: ["lunch"] }).map((id) => places.find((p) => p.id === id)!))).toEqual([
      { name: "Hayes Valley", count: 1 },
      { name: "Mission", count: 1 },
    ]);
  });
});

describe("sortPlaces", () => {
  it("puts top picks first, then sorts by name", () => {
    expect(sortPlaces(places).map((p) => p.id)).toEqual([
      "trick-dog",
      "zuni",
      "la-taqueria",
      "ocean-beach",
    ]);
  });
});
