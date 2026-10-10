import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildSearchIndex, editDistance, searchPlaces } from "./search";
import type { Place } from "./types";

const { places }: { places: Place[] } = JSON.parse(readFileSync(path.join(process.cwd(), "data/places.json"), "utf8"));
const index = buildSearchIndex(places);
const ids = (query: string) => searchPlaces(index, query).map((hit) => hit.id);
const byId = new Map(places.map((p) => [p.id, p]));

describe("searchPlaces, against the guide", () => {
  it("finds the dim sum places, whether or not the words are in their names", () => {
    const found = ids("dim sum");
    expect(found.slice(0, 4).sort()).toEqual(["china-live", "hk-lounge-bistro", "r-and-g-lounge", "yank-sing"]);
    expect(found).toHaveLength(4);
    expect(found.every((id) => byId.has(id))).toBe(true);
  });

  it("forgives typos and run-together words", () => {
    for (const typo of ["dimsum", "dim sun"]) expect(ids(typo).sort(), typo).toEqual(ids("dim sum").sort());
    expect(ids("taqeria").slice(0, 3).sort()).toEqual(["la-taqueria", "taqueria-el-buen-sabor", "taqueria-el-farolito"]);
    const coffee = ids("cofee");
    expect(coffee.slice(0, 4).every((id) => /coffee/i.test(byId.get(id)!.name))).toBe(true);
  });

  it("matches partial words while typing", () => {
    expect(ids("taq").sort()).toEqual(["la-taqueria", "taqueria-el-buen-sabor", "taqueria-el-farolito"]);
    expect(ids("yank s")).toEqual(["yank-sing"]);
  });

  it("finds a neighborhood's places", () => {
    const found = ids("north beach");
    const inNorthBeach = places.filter((p) => p.neighborhood === "North Beach").map((p) => p.id);
    expect(inNorthBeach.length).toBeGreaterThan(5);
    expect(found).toEqual(expect.arrayContaining(inNorthBeach));
  });

  it("reaches places only a synonym describes, and only real ones", () => {
    // "Dim sum" appears nowhere guests can read about China Live or R&G Lounge.
    for (const id of ["china-live", "r-and-g-lounge"]) {
      const { name, summary, signatureSubject, neighborhood, address, note } = byId.get(id)!;
      const text = [name, summary, signatureSubject, neighborhood, address, note].join(" ").toLowerCase();
      expect(text, id).not.toMatch(/dim sum/);
    }
    expect(ids("dim sum")).toEqual(expect.arrayContaining(["china-live", "r-and-g-lounge"]));
    // "burrito" brings in the taquerias by name.
    expect(ids("burrito")).toEqual(expect.arrayContaining(["taqueria-el-farolito", "taqueria-el-buen-sabor"]));
    // No boba place in the guide: the concept finds nothing rather than a near miss.
    expect(ids("boba")).toEqual([]);
  });

  it("finds nothing for gibberish, and waits for a second letter", () => {
    expect(ids("xyzzy")).toEqual([]);
    expect(ids("q")).toEqual([]);
    expect(ids("   ")).toEqual([]);
  });

  it("ranks a name hit over a description hit", () => {
    expect(ids("coffee")[0]).toMatch(/coffee/);
    const hits = searchPlaces(index, "tartine");
    expect(hits[0].best).toBe("name");
  });
});

describe("editDistance", () => {
  it("counts a swap of neighbors as one edit and stops past the limit", () => {
    expect(editDistance("cofee", "coffee", 2)).toBe(1);
    expect(editDistance("taqeria", "taqueria", 2)).toBe(1);
    expect(editDistance("dmi", "dim", 1)).toBe(1);
    expect(editDistance("abcdef", "uvwxyz", 2)).toBe(3);
  });
});
