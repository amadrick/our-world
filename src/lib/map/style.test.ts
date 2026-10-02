import { existsSync } from "node:fs";
import path from "node:path";

import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import { LANDMARK_LAYERS, LANDMARKS_FROM_ZOOM, buildMapStyle } from "./style";
import { DEFAULT_MAP_THEME, MAP_THEMES, currentMapTheme, parseMapTheme, type MapThemeId } from "./theme";
import { missingImage } from "./themes/kit";
import { WATERCOLOR_TEXTURES, type WatercolorTexture } from "./themes/watercolor";

const themes = Object.keys(MAP_THEMES) as MapThemeId[];

describe("basemap landmarks", () => {
  it("keeps every theme's parks, landmarks, and hills off the city view and fades them in closer", () => {
    for (const theme of themes) {
      for (const scheme of ["light", "dark"] as const) {
        const style = buildMapStyle({ theme, tiles: "offline", origin: "http://localhost", scheme });
        const landmarks = style.layers.filter((layer) => LANDMARK_LAYERS.has(layer.id));
        for (const layer of landmarks) {
          expect(layer.minzoom ?? 0, `${theme} ${layer.id}`).toBeGreaterThanOrEqual(LANDMARKS_FROM_ZOOM);
          const opacity = (layer.paint as Record<string, unknown>)["text-opacity"];
          expect(JSON.stringify(opacity), `${theme} ${layer.id}`).toContain("zoom");
        }
      }
    }
  });
});

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

  it("draws every generated image a theme asks for, and ships every texture file", () => {
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
          collect((props as Record<string, unknown>)["background-pattern"]);
        }
      }
    }
    const textures = [...ids].filter((id) => id in WATERCOLOR_TEXTURES);
    const generated = [...ids].filter((id) => !(id in WATERCOLOR_TEXTURES));
    expect(generated.length).toBeGreaterThan(4);
    for (const id of generated) expect(missingImage(id), id).not.toBeNull();
    expect(textures.length).toBeGreaterThan(0);
    for (const id of textures) {
      const file = path.join(process.cwd(), "public", WATERCOLOR_TEXTURES[id as WatercolorTexture].url);
      expect(existsSync(file), id).toBe(true);
    }
  });
});

describe("parseMapTheme", () => {
  it("reads the short keys and the full names", () => {
    expect(parseMapTheme("a")).toBe("golden");
    expect(parseMapTheme("B")).toBe("editorial");
    expect(parseMapTheme("dimensional")).toBe("dimensional");
    expect(parseMapTheme("d")).toBe("apple");
    expect(parseMapTheme("e")).toBe("film");
    expect(parseMapTheme("f")).toBe("ink");
    expect(parseMapTheme("Ink")).toBe("ink");
    expect(parseMapTheme("g")).toBe("paper");
    expect(parseMapTheme("h")).toBe("watercolor");
  });

  it("ignores anything else", () => {
    expect(parseMapTheme("z")).toBeNull();
    expect(parseMapTheme("")).toBeNull();
    expect(parseMapTheme(null)).toBeNull();
  });
});

describe("currentMapTheme", () => {
  it("shows the watercolor basemap unless ?map= asks for another", () => {
    expect(DEFAULT_MAP_THEME).toBe("watercolor");
    expect(currentMapTheme()).toBe("watercolor");
  });
});

describe("the open place's tint", () => {
  // A data-driven paint value that changes makes MapLibre reload every tile of its source.
  it("only changes paint values that are the same for every feature, so a selection never reloads the basemap", () => {
    const dataDriven = (value: unknown): boolean =>
      Array.isArray(value) && (value[0] === "get" || value[0] === "has" || value[0] === "geometry-type" || value.some(dataDriven));
    // The default and the live experiments; the older directions still pick some tinted colors per feature.
    for (const theme of ["film", "ink", "paper", "watercolor"] as const) {
      for (const scheme of ["light", "dark"] as const) {
        const plain = buildMapStyle({ theme, tiles: "offline", origin: "", scheme });
        const tinted = buildMapStyle({ theme, tiles: "offline", origin: "", scheme, tint: "#b04a3a" });
        tinted.layers.forEach((layer, i) => {
          const before = (plain.layers[i] as { paint?: Record<string, unknown> }).paint ?? {};
          const after = (layer as { paint?: Record<string, unknown> }).paint ?? {};
          for (const [name, value] of Object.entries(after)) {
            if (JSON.stringify(value) === JSON.stringify(before[name])) continue;
            expect(dataDriven(value), `${theme} ${scheme} ${layer.id} ${name}`).toBe(false);
          }
        });
      }
    }
  });
});
