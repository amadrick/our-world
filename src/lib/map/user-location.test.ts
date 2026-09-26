import { describe, expect, it } from "vitest";

import { accuracyHaloPx, metersPerPixel } from "./user-location";

describe("user location", () => {
  it("knows how much ground a pixel covers", () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(78271.5, 0);
    // Each zoom level halves it; San Francisco's latitude shrinks it by cos(37.8°).
    expect(metersPerPixel(37.7749, 15)).toBeCloseTo((78271.5 * Math.cos((37.7749 * Math.PI) / 180)) / 2 ** 15, 3);
  });

  it("sizes the accuracy halo to the accuracy radius, within bounds", () => {
    const perPx = metersPerPixel(37.7749, 15);
    expect(accuracyHaloPx(30, 37.7749, 15)).toBe(Math.round(60 / perPx));
    expect(accuracyHaloPx(5000, 37.7749, 18)).toBe(640);
    expect(accuracyHaloPx(0, 37.7749, 15)).toBe(0);
  });
});
