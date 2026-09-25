import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import { buildMapStyle } from "./style";
import { DEFAULT_MAP_THEME, MAP_THEMES, currentMapTheme, parseMapTheme, type MapThemeId } from "./theme";
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
            pins: [
              { id: "a", lng: -122.42, lat: 37.76, kind: "glyph", display: "named", selected: false, name: "Tartine" },
              { id: "coit-tower", lng: -122.4058, lat: 37.8024, kind: "photo", display: "icon", selected: true, name: "Coit Tower" },
            ],
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

  it("leaves out a basemap landmark while the guide's own pin for it is on the map", () => {
    const names = (pins: Parameters<typeof buildMapStyle>[0]["pins"]) => {
      const source = buildMapStyle({ theme: "apple", tiles: "offline", origin: "", pins }).sources.landmarks;
      const data = (source as { data: GeoJSON.FeatureCollection }).data;
      return data.features.map((f) => f.properties?.name);
    };
    expect(names([])).toContain("Coit Tower");
    const coit = { id: "coit-tower", lng: -122.4058, lat: 37.8024, kind: "photo" as const, display: "hidden" as const, selected: false, name: "Coit Tower" };
    expect(names([coit])).not.toContain("Coit Tower");
    expect(names([coit])).toContain("Sutro Tower");
  });

  it("hides basemap park and neighborhood labels that repeat a photo pin's name", () => {
    const pin = { id: "dolores-park", lng: -122.4276, lat: 37.7596, kind: "photo" as const, display: "icon" as const, selected: false, name: "Dolores Park" };
    const { layers } = buildMapStyle({ theme: "apple", tiles: "offline", origin: "", pins: [pin] });
    const park = layers.find((layer) => layer.id === "park-label");
    expect(JSON.stringify(park && "filter" in park && park.filter)).toContain("Dolores Park");
    const water = layers.find((layer) => layer.id === "water-label");
    expect(JSON.stringify(water && "filter" in water && water.filter)).not.toContain("Dolores Park");
  });

  it("only shades hills when elevation tiles are there, in the themes that shade them", () => {
    for (const theme of themes) {
      const withTerrain = buildMapStyle({ theme, tiles: "offline", origin: "", terrain: true });
      const without = buildMapStyle({ theme, tiles: "offline", origin: "", terrain: false });
      expect(Boolean(withTerrain.sources.terrain), theme).toBe(Boolean(MAP_THEMES[theme].hills));
      expect(without.sources.terrain).toBeUndefined();
      expect(without.layers.some((layer) => layer.type === "hillshade")).toBe(false);
    }
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
    expect(parseMapTheme("d")).toBe("apple");
    expect(parseMapTheme("e")).toBe("film");
  });

  it("ignores anything else", () => {
    expect(parseMapTheme("z")).toBeNull();
    expect(parseMapTheme("")).toBeNull();
    expect(parseMapTheme(null)).toBeNull();
  });
});

describe("currentMapTheme", () => {
  it("shows the film basemap unless ?map= asks for another", () => {
    expect(DEFAULT_MAP_THEME).toBe("film");
    expect(currentMapTheme()).toBe("film");
  });
});
