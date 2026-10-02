import { describe, expect, it } from "vitest";

import { contrastRatio } from "../images/palette.mjs";
import { APPLE_PINS, FILM_PINS, INK_PINS, PAPER_PINS, pinPalette, type PinPalette } from "./pin-style";
import { MAP_THEMES, type MapThemeId } from "./theme";

describe("pinPalette", () => {
  it("gives film, ink, and paper their own colors, watercolor paper's, and every other basemap Apple's", () => {
    const own: Partial<Record<MapThemeId, PinPalette>> = { film: FILM_PINS, ink: INK_PINS, paper: PAPER_PINS, watercolor: PAPER_PINS };
    for (const theme of Object.keys(MAP_THEMES) as MapThemeId[]) {
      expect(pinPalette(theme), theme).toBe(own[theme] ?? APPLE_PINS);
    }
  });

  it.each([
    ["film", FILM_PINS],
    ["ink", INK_PINS],
    ["paper", PAPER_PINS],
  ] as const)("keeps %s names and captions readable on their halos", (_, palette) => {
    const { halo } = palette;
    for (const [category, color] of Object.entries(palette.categories)) {
      expect(contrastRatio(color.label, halo.light), category).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(color.labelDark, halo.dark), category).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(palette.caption.light, halo.light)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.caption.dark, halo.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it("covers the same categories in every palette", () => {
    for (const palette of [FILM_PINS, INK_PINS, PAPER_PINS]) {
      expect(Object.keys(palette.categories).sort()).toEqual(Object.keys(APPLE_PINS.categories).sort());
    }
  });

  it("only overrides the pin shadows where a basemap asks to", () => {
    expect(APPLE_PINS.shadow).toBeUndefined();
    expect(FILM_PINS.shadow).toBeUndefined();
    expect(INK_PINS.shadow?.glyph.light).toMatch(/^0 0 0 2px #FFFFFF/);
  });
});
