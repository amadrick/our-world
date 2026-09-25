import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { contrastRatio } from "../images/palette.mjs";
import { placeInputSchema } from "./schema";
import type { Place } from "./types";

const ROOT = process.cwd();
const places: Place[] = JSON.parse(
  readFileSync(path.join(ROOT, "data", "places.json"), "utf8"),
).places;

describe("data/places.json", () => {
  it("passes the same validation as a place saved from the admin", () => {
    for (const place of places) {
      // A few seed places list up to 14 research sources; the admin caps a save at 12.
      const research = place.placeResearch && {
        ...place.placeResearch,
        sources: place.placeResearch.sources.slice(0, 12),
      };
      const result = placeInputSchema.safeParse({ ...place, placeResearch: research });
      expect(result.success, `${place.id}: ${result.error?.issues[0]?.message}`).toBe(true);
    }
  });

  it("gives every picture a sampled page color that white text reads on", () => {
    for (const place of places) {
      if (!place.image) continue;
      expect(place.imageColor, place.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(place.imageColor!, "#ffffff"), place.id).toBeGreaterThan(7);
    }
  });

  it("holds Andy's 93 places, with no Wellness section left", () => {
    expect(places).toHaveLength(93);
    expect(places.some((p) => p.id === "alchemy-springs")).toBe(false);
    expect(new Set(places.map((p) => p.category)).has("wellness" as Place["category"])).toBe(false);
  });

  it("fills Shops, Museums, and Parks with exactly Andy's list", () => {
    const inSection = (category: Place["category"]) =>
      places
        .filter((p) => p.category === category)
        .map((p) => p.id)
        .sort();
    expect(inSection("shop")).toEqual(
      [
        "evan-kinori",
        "rachel-comey",
        "self-edge",
        "sf76",
        "relove",
        "reliquary",
        "ministry-of-scent",
        "heath-ceramics",
        "william-stout-architectural-books",
      ].sort(),
    );
    expect(inSection("museum")).toEqual(["de-young-museum", "sfmoma"]);
    expect(inSection("park")).toEqual(["golden-gate-park", "ocean-beach"]);
  });

  it("never tags shops or parks with meals or late night", () => {
    for (const place of places) {
      if (!["shop", "park"].includes(place.category)) continue;
      expect(
        place.tags.filter((t) => t !== "views"),
        place.id,
      ).toEqual([]);
    }
  });

  it("marks Andy's favorites and shows his own pick as what each is known for", () => {
    const byId = (id: string) => places.find((p) => p.id === id);
    expect(places.filter((p) => p.andyFavorite)).toHaveLength(45);
    expect(byId("arsicault-bakery")?.signatureSubject).toBe("Chocolate almond croissant");
    expect(byId("yank-sing")?.signatureSubject).toBe("Pot stickers");
    expect(byId("house-of-prime-rib")?.signatureSubject).toBe("King's cut");
    // "Good" or "fine" marks the place without replacing what it's known for.
    expect(byId("daeho")).toMatchObject({ andyFavorite: true, signatureSubject: "Cheese kalbijjim (blowtorched)" });
  });

  it("leaves Limón, Ordinaire, and Song Tea as they are until Andy decides", () => {
    const byId = (id: string) => places.find((p) => p.id === id);
    expect(byId("limon-rotisserie")?.andyFavorite).toBeUndefined();
    expect(byId("ordinaire")?.andyFavorite).toBeUndefined();
    expect(byId("song-tea-and-ceramics")?.category).toBe("coffee");
  });

  it("has unique ids", () => {
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length);
  });

  it("points only at images that exist, and every image belongs to a place", () => {
    const referenced = new Set(places.flatMap((p) => (p.image ? [p.image] : [])));
    for (const image of referenced) {
      expect(existsSync(path.join(ROOT, "public", image)), image).toBe(true);
    }
    const onDisk = readdirSync(path.join(ROOT, "public", "places")).map((f) => `/places/${f}`);
    expect(onDisk.filter((f) => !referenced.has(f))).toEqual([]);
  });
});
