import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import { buildMapStyle } from "./style";
import { MAP_THEMES, parseMapTheme, type MapThemeId } from "./theme";
import { missingImage } from "./themes/kit";

const themes = Object.keys(MAP_THEMES) as MapThemeId[];

describe("buildMapStyle", () => {
  for (const theme of themes) {
    for (const scheme of ["light", "dark"] as const) {
      for (const tint of [null, "#23453b"]) {
        it(`builds a valid ${theme} style, ${scheme}${tint ? ", tinted" : ""}`, () => {
          const style = buildMapStyle({
            theme,
            tiles: "offline",
            origin: "http://localhost",
            scheme,
            tint,
            terrain: true,
            pins: [{ id: "a", lng: -122.42, lat: 37.76, display: "label", name: "Tartine" }],
          });
          expect(validateStyleMin(style).map((error) => error.message)).toEqual([]);
        });
      }
    }
  }

  it("keeps the pins' collision boxes above every other label", () => {
    for (const theme of themes) {
      const { layers } = buildMapStyle({ theme, tiles: "offline", origin: "" });
      expect(layers.at(-1)?.id).toBe("pin-footprints");
    }
  });

  it("only shades hills when elevation tiles are there", () => {
    const withTerrain = buildMapStyle({ theme: "dimensional", tiles: "offline", origin: "", terrain: true });
    const without = buildMapStyle({ theme: "dimensional", tiles: "offline", origin: "", terrain: false });
    expect(withTerrain.sources.terrain).toBeDefined();
    expect(without.sources.terrain).toBeUndefined();
    expect(without.layers.some((layer) => layer.type === "hillshade")).toBe(false);
  });

  it("draws every generated image a theme asks for", () => {
    const ids = new Set<string>();
    for (const theme of themes) {
      for (const scheme of ["light", "dark"] as const) {
        const style = buildMapStyle({ theme, tiles: "offline", origin: "", scheme, terrain: true });
        const collect = (value: unknown): void => {
          if (typeof value === "string" && /^[a-z]+-/.test(value)) ids.add(value);
          else if (Array.isArray(value)) value.forEach(collect);
        };
        for (const layer of style.layers) {
          const props = { ...("layout" in layer ? layer.layout : {}), ...("paint" in layer ? layer.paint : {}) };
          collect((props as Record<string, unknown>)["icon-image"]);
          collect((props as Record<string, unknown>)["fill-pattern"]);
        }
      }
    }
    expect(ids.size).toBeGreaterThan(4);
    for (const id of ids) expect(missingImage(id), id).not.toBeNull();
  });
});

describe("parseMapTheme", () => {
  it("reads the short keys and the full names", () => {
    expect(parseMapTheme("a")).toBe("golden");
    expect(parseMapTheme("B")).toBe("editorial");
    expect(parseMapTheme("dimensional")).toBe("dimensional");
  });

  it("ignores anything else", () => {
    expect(parseMapTheme("z")).toBeNull();
    expect(parseMapTheme("")).toBeNull();
    expect(parseMapTheme(null)).toBeNull();
  });
});
