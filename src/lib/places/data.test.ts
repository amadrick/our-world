import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { contrastRatio, darkPinColor, whiteTextReads } from "../images/palette.mjs";
import { EMPTY_FILTERS, filterPlaces } from "./filters";
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
      // White and its 70% tint at AA on the page, the sheet, and the light map's pins.
      expect(whiteTextReads(place.imageColor!), place.id).toBe(true);
      // And on the dark map's lifted pins and name pills.
      expect(contrastRatio(darkPinColor(place.imageColor!), "#ffffff"), place.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("holds Andy's 93 places plus the 23 Sights, with no Wellness section left", () => {
    expect(places).toHaveLength(116);
    expect(places.filter((p) => p.category !== "sight")).toHaveLength(93);
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

  it("fills Sights with the iconic places, none of them duplicating a place already in the guide", () => {
    expect(
      places
        .filter((p) => p.category === "sight")
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      [
        "golden-gate-bridge",
        "alcatraz",
        "fishermans-wharf",
        "pier-39",
        "ghirardelli-square",
        "lombard-street",
        "coit-tower",
        "transamerica-pyramid",
        "ferry-building",
        "dragon-gate",
        "powell-market-cable-car-turnaround",
        "painted-ladies",
        "palace-of-fine-arts",
        "crissy-field",
        "twin-peaks",
        "dolores-park",
        "city-hall",
        "lands-end-sutro-baths",
        "legion-of-honor",
        "haight-ashbury",
        "castro-theatre",
        "grace-cathedral",
        "exploratorium",
      ].sort(),
    );
  });

  it("keeps each sight researched with its own photo and a view, without an own-pick line", () => {
    for (const place of places.filter((p) => p.category === "sight")) {
      expect(place.signatureRationale ?? "", place.id).not.toMatch(/own pick/);
      expect(place.placeResearch?.viewNote, place.id).toBeTruthy();
      expect(place.placeResearch?.sources.length, place.id).toBeGreaterThanOrEqual(3);
      expect(place.image, place.id).toMatch(/^\/places\//);
    }
  });

  it("never tags shops, parks, or sights with meals or late night", () => {
    for (const place of places) {
      if (!["shop", "park", "sight"].includes(place.category)) continue;
      expect(
        place.tags.filter((t) => t !== "views"),
        place.id,
      ).toEqual([]);
    }
  });

  it("marks favorites and who picked the place, without claiming they wrote Known for", () => {
    const byId = (id: string) => places.find((p) => p.id === id);
    const ids = (list: typeof places) => list.map((p) => p.id).sort();
    expect(ids(places.filter((p) => p.favorite))).toEqual([
      "arsicault-bakery",
      "bodega-sf",
      "capos",
      "coit-tower",
      "comstock-saloon",
      "cotogna",
      "dandelion-chocolate",
      "de-young-museum",
      "dolores-park",
      "evan-kinori",
      "ferry-building",
      "flour-and-water",
      "foreign-cinema",
      "garden-creamery",
      "golden-gate-park",
      "hedge-coffee",
      "hk-lounge-bistro",
      "hook-fish",
      "house-of-prime-rib",
      "jules",
      "kope-house",
      "la-taqueria",
      "lush-gelato",
      "maillards",
      "maison-nico",
      "ministry-of-scent",
      "molinari-delicatessen",
      "nopa",
      "nopa-fish",
      "nopalito",
      "ocean-beach",
      "original-joes",
      "pearl-6101",
      "rachel-comey",
      "radhaus",
      "rampant-bottle-and-bar",
      "reliquary",
      "relove",
      "rt-rotisserie",
      "saint-frank-coffee",
      "san-tung",
      "self-edge",
      "sf76",
      "sfmoma",
      "shoji",
      "tartine-bakery",
      "the-coffee-movement",
      "the-laundromat-sf",
      "the-page",
      "tony-niks",
      "toronado",
      "trick-dog",
      "true-laurel",
      "verjus",
      "yank-sing",
    ]);
    expect(ids(places.filter((p) => p.pickBy === "andy"))).toEqual([
      "evan-kinori",
      "hk-lounge-bistro",
      "house-of-prime-rib",
      "la-taqueria",
      "maillards",
      "pearl-6101",
      "tony-niks",
      "toronado",
    ]);
    expect(ids(places.filter((p) => p.pickBy === "kirissa"))).toEqual([
      "ministry-of-scent",
      "nopa-fish",
      "rachel-comey",
      "radhaus",
      "reliquary",
      "relove",
      "rt-rotisserie",
      "saint-frank-coffee",
      "shoji",
      "trick-dog",
    ]);
    expect(ids(places.filter((p) => p.pickBy === "both"))).toEqual([
      "flour-and-water",
      "hedge-coffee",
      "jules",
      "kope-house",
      "molinari-delicatessen",
      "nopalito",
      "rampant-bottle-and-bar",
      "sf76",
      "the-coffee-movement",
      "the-laundromat-sf",
      "the-page",
      "true-laurel",
      "yank-sing",
    ]);
    expect(ids(places.filter((p) => p.favorite && !p.pickBy))).toEqual([
      "arsicault-bakery",
      "bodega-sf",
      "capos",
      "coit-tower",
      "comstock-saloon",
      "cotogna",
      "dandelion-chocolate",
      "de-young-museum",
      "dolores-park",
      "ferry-building",
      "foreign-cinema",
      "garden-creamery",
      "golden-gate-park",
      "hook-fish",
      "lush-gelato",
      "maison-nico",
      "nopa",
      "ocean-beach",
      "original-joes",
      "san-tung",
      "self-edge",
      "sfmoma",
      "tartine-bakery",
      "verjus",
    ]);
    for (const place of places) {
      if (place.pickBy) expect(place.favorite, place.id).toBe(true);
      expect(place.signatureRationale ?? "", place.id).not.toMatch(/own pick|Our pick\./);
    }
    expect(places.filter((p) => p.favorite)).toHaveLength(55);
    expect(filterPlaces(places, { ...EMPTY_FILTERS, pills: ["favorites"] })).toHaveLength(55);
    expect(byId("arsicault-bakery")?.signatureSubject).toBe("Chocolate almond croissant");
    expect(byId("yank-sing")?.signatureSubject).toBe("Pot stickers");
    expect(byId("house-of-prime-rib")?.signatureSubject).toBe("King's cut");
    expect(byId("daeho")?.favorite).toBeUndefined();
    expect(byId("daeho")?.signatureSubject).toBe("Cheese kalbijjim (blowtorched)");
    // The box is unticked, and the owner is what keeps it a favorite.
    expect(byId("pearl-6101")).toMatchObject({ favorite: true, pickBy: "andy" });
  });

  it("leaves Limón, Ordinaire, and Song Tea as they are until Andy decides", () => {
    const byId = (id: string) => places.find((p) => p.id === id);
    expect(byId("limon-rotisserie")?.favorite).toBeUndefined();
    expect(byId("limon-rotisserie")?.pickBy).toBeUndefined();
    expect(byId("ordinaire")?.favorite).toBeUndefined();
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
