import { describe, expect, it } from "vitest";

import { contrastRatio } from "../images/palette.mjs";
import { APPLE_PINS, FILM_PINS, pinPalette } from "./pin-style";
import { MAP_THEMES, type MapThemeId } from "./theme";

describe("pinPalette", () => {
  it("gives the film basemap its own colors and every other basemap Apple's", () => {
    for (const theme of Object.keys(MAP_THEMES) as MapThemeId[]) {
      expect(pinPalette(theme), theme).toBe(theme === "film" ? FILM_PINS : APPLE_PINS);
    }
  });

  it("keeps film names and captions readable on the film land", () => {
    const { halo } = FILM_PINS;
    for (const [category, color] of Object.entries(FILM_PINS.categories)) {
      expect(contrastRatio(color.label, halo.light), category).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(color.labelDark, halo.dark), category).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(FILM_PINS.caption.light, halo.light)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(FILM_PINS.caption.dark, halo.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it("covers the same categories in every palette", () => {
    expect(Object.keys(FILM_PINS.categories).sort()).toEqual(Object.keys(APPLE_PINS.categories).sort());
  });
});
