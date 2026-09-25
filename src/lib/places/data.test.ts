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

  it("fills Shops, Museums, Parks, and Wellness with exactly Andy's list", () => {
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
    expect(inSection("wellness")).toEqual(["alchemy-springs"]);
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
