import { apple } from "./themes/apple";
import { dimensional } from "./themes/dimensional";
import { editorial } from "./themes/editorial";
import { film } from "./themes/film";
import { golden } from "./themes/golden";
import type { MapTheme, MapThemeId } from "./themes/kit";

export type { MapThemeId } from "./themes/kit";

export const MAP_THEMES: Record<MapThemeId, MapTheme> = { golden, editorial, dimensional, apple, film };

/** The basemap everyone sees. */
export const DEFAULT_MAP_THEME: MapThemeId = "apple";

/** `?map=a|b|c|d|e`: a hidden switch for comparing the basemap directions. */
const KEYS: Record<string, MapThemeId> = { a: "golden", b: "editorial", c: "dimensional", d: "apple", e: "film" };

export function parseMapTheme(value: string | null | undefined): MapThemeId | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (key in KEYS) return KEYS[key];
  return key in MAP_THEMES ? (key as MapThemeId) : null;
}

const STORAGE_KEY = "sf-recs:map-theme";

/** The theme from the URL (remembered for the session, so it survives opening a place), or the default. */
export function currentMapTheme(): MapThemeId {
  try {
    const fromUrl = parseMapTheme(new URLSearchParams(window.location.search).get("map"));
    if (fromUrl) {
      window.sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return parseMapTheme(window.sessionStorage.getItem(STORAGE_KEY)) ?? DEFAULT_MAP_THEME;
  } catch {
    return DEFAULT_MAP_THEME;
  }
}
