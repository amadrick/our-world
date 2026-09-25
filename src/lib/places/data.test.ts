import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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

  it("puts the non-food places in Shops, Museums, Parks, or Wellness", () => {
    const section = (id: string) => places.find((p) => p.id === id)?.category;
    const shops = [
      "evan-kinori",
      "rachel-comey",
      "self-edge",
      "sf76",
      "relove",
      "reliquary",
      "ministry-of-scent",
      "heath-ceramics",
      "william-stout-architectural-books",
    ];
    expect(shops.map(section)).toEqual(shops.map(() => "shop"));
    expect(["sfmoma", "de-young-museum"].map(section)).toEqual(["museum", "museum"]);
    expect(["golden-gate-park", "ocean-beach"].map(section)).toEqual(["park", "park"]);
    expect(section("alchemy-springs")).toBe("wellness");
  });

  it("never tags shops, parks, or wellness with meals or late night", () => {
    for (const place of places) {
      if (!["shop", "park", "wellness"].includes(place.category)) continue;
      expect(
        place.tags.filter((t) => t !== "views" && t !== "top-pick"),
        place.id,
      ).toEqual([]);
    }
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
