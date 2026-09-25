import { describe, expect, it } from "vitest";

import { CATEGORIES, FILTER_PILLS, FILTER_TAGS, TAGS } from "./taxonomy";

describe("taxonomy", () => {
  it("keeps the food and drink sections, then Shops, Museums, Parks, and Wellness", () => {
    expect(CATEGORIES.map((c) => c.plural)).toEqual([
      "Restaurants",
      "Bars",
      "Wine",
      "Coffee & tea",
      "Bakeries",
      "Dessert",
      "Shops",
      "Museums",
      "Parks",
      "Wellness",
    ]);
  });

  it("offers Andy's favorites first, then the five tag pills, in order", () => {
    expect(FILTER_PILLS.map((p) => p.label)).toEqual([
      "Andy’s favorites",
      "Dinner",
      "Lunch",
      "Late night",
      "Brunch",
      "Views",
    ]);
  });

  it("keeps only the five pills as tags; Andy's pick is its own flag", () => {
    expect(TAGS.map((t) => t.id)).toEqual(["dinner", "lunch", "late-night", "brunch", "views"]);
    expect(FILTER_TAGS.map((t) => t.id)).toEqual(TAGS.map((t) => t.id));
  });
});
