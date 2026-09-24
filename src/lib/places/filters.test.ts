import { describe, expect, it } from "vitest";

import { EMPTY_FILTERS, filterPlaces, sortPlaces } from "./filters";
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
  place("zuni", { neighborhood: "Hayes Valley", tags: ["top-pick", "book-ahead"] }),
  place("trick-dog", { category: "bar", tags: ["top-pick", "late-night"] }),
  place("la-taqueria", { tags: ["walkable"] }),
];

describe("filterPlaces", () => {
  it("returns everything with no filters", () => {
    expect(filterPlaces(places, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("combines category, neighborhood, and tags", () => {
    const ids = (f: Partial<typeof EMPTY_FILTERS>) =>
      filterPlaces(places, { ...EMPTY_FILTERS, ...f }).map((p) => p.id);
    expect(ids({ category: "bar" })).toEqual(["trick-dog"]);
    expect(ids({ neighborhood: "Mission" })).toEqual(["trick-dog", "la-taqueria"]);
    expect(ids({ tags: ["top-pick"] })).toEqual(["zuni", "trick-dog"]);
    expect(ids({ tags: ["top-pick", "late-night"] })).toEqual(["trick-dog"]);
    expect(ids({ category: "restaurant", tags: ["late-night"] })).toEqual([]);
  });
});

describe("sortPlaces", () => {
  it("puts top picks first, then sorts by name", () => {
    expect(sortPlaces(places).map((p) => p.id)).toEqual(["trick-dog", "zuni", "la-taqueria"]);
  });
});
