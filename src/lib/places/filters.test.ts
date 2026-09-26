import { describe, expect, it } from "vitest";

import {
  EMPTY_FILTERS,
  filterPlaces,
  matchesInOtherSections,
  neighborhoodCounts,
  pillCounts,
  sortPlaces,
} from "./filters";
import { PILL_IDS, type Place } from "./types";

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
  place("zuni", { neighborhood: "Hayes Valley", tags: ["dinner", "lunch"], favorite: true }),
  place("trick-dog", { category: "bar", tags: ["dinner", "late-night"] }),
  place("la-taqueria", { tags: ["lunch"], favorite: true, pickBy: "andy" }),
  place("pearl", { pickBy: "andy" }),
  place("ocean-beach", { category: "park", neighborhood: "Outer Sunset", tags: ["views"] }),
];
const ids = (f: Partial<typeof EMPTY_FILTERS>) =>
  filterPlaces(places, { ...EMPTY_FILTERS, ...f }).map((p) => p.id);

describe("filterPlaces", () => {
  it("returns everything with no filters", () => {
    expect(filterPlaces(places, EMPTY_FILTERS)).toHaveLength(5);
  });

  it("combines a section, a neighborhood, and pills", () => {
    expect(ids({ category: "bar" })).toEqual(["trick-dog"]);
    expect(ids({ category: "park" })).toEqual(["ocean-beach"]);
    expect(ids({ neighborhood: "Mission" })).toEqual(["trick-dog", "la-taqueria", "pearl"]);
    expect(ids({ pills: ["dinner"] })).toEqual(["zuni", "trick-dog"]);
    expect(ids({ pills: ["dinner", "late-night"] })).toEqual(["trick-dog"]);
    expect(ids({ category: "bar", pills: ["late-night"] })).toEqual(["trick-dog"]);
    expect(ids({ category: "restaurant", pills: ["late-night"] })).toEqual([]);
  });

  it("filters to our favorites, including a pick with the box unticked", () => {
    expect(ids({ pills: ["favorites"] })).toEqual(["zuni", "la-taqueria", "pearl"]);
    expect(ids({ pills: ["favorites", "dinner"] })).toEqual(["zuni"]);
    expect(ids({ category: "bar", pills: ["favorites"] })).toEqual([]);
  });
});

describe("pillCounts", () => {
  it("counts what each pill would leave across every section", () => {
    const counts = pillCounts(places, EMPTY_FILTERS, PILL_IDS);
    expect(Object.fromEntries(counts)).toEqual({
      favorites: 3,
      dinner: 2,
      lunch: 2,
      "late-night": 1,
      brunch: 0,
      views: 1,
    });
  });

  it("scopes the counts to the chosen section, so pills with nothing there read zero", () => {
    const counts = pillCounts(places, { ...EMPTY_FILTERS, category: "park" }, PILL_IDS);
    expect([...counts].filter(([, n]) => n > 0).map(([pill]) => pill)).toEqual(["views"]);
  });

  it("gives an active pill the current count and narrows the others", () => {
    const counts = pillCounts(places, { ...EMPTY_FILTERS, pills: ["dinner"] }, PILL_IDS);
    expect(counts.get("dinner")).toBe(2);
    expect(counts.get("favorites")).toBe(1);
    expect(counts.get("late-night")).toBe(1);
    expect(counts.get("lunch")).toBe(1);
    expect(counts.get("views")).toBe(0);
  });
});

describe("matchesInOtherSections", () => {
  it("counts matches elsewhere when a section is empty for the chosen pills", () => {
    const filters = { ...EMPTY_FILTERS, category: "park" as const, pills: ["late-night" as const] };
    expect(filterPlaces(places, filters)).toEqual([]);
    expect(matchesInOtherSections(places, filters)).toBe(1);
  });

  it("offers favorites from other sections too", () => {
    const filters = { ...EMPTY_FILTERS, category: "bar" as const, pills: ["favorites" as const] };
    expect(matchesInOtherSections(places, filters)).toBe(3);
  });

  it("is zero without both a section and a pill", () => {
    expect(matchesInOtherSections(places, { ...EMPTY_FILTERS, category: "park" })).toBe(0);
    expect(matchesInOtherSections(places, { ...EMPTY_FILTERS, pills: ["dinner"] })).toBe(0);
  });
});

describe("neighborhoodCounts", () => {
  it("counts only the places it is given, so it can follow the section and pills", () => {
    expect(neighborhoodCounts(ids({ pills: ["lunch"] }).map((id) => places.find((p) => p.id === id)!))).toEqual([
      { name: "Hayes Valley", count: 1 },
      { name: "Mission", count: 1 },
    ]);
  });
});

describe("sortPlaces", () => {
  it("sorts by name", () => {
    expect(sortPlaces(places).map((p) => p.id)).toEqual([
      "la-taqueria",
      "ocean-beach",
      "pearl",
      "trick-dog",
      "zuni",
    ]);
  });
});
