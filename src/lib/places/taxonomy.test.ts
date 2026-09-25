import { describe, expect, it } from "vitest";

import { CATEGORIES, FILTER_TAGS, TAGS } from "./taxonomy";

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

  it("offers exactly five filter pills, in order", () => {
    expect(FILTER_TAGS.map((t) => t.label)).toEqual([
      "Dinner",
      "Lunch",
      "Late night",
      "Brunch",
      "Views",
    ]);
  });

  it("keeps only the pills and the top-pick star as tags", () => {
    expect(TAGS.map((t) => t.id)).toEqual([
      "top-pick",
      "dinner",
      "lunch",
      "late-night",
      "brunch",
      "views",
    ]);
  });
});
