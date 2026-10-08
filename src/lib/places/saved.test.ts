import { describe, expect, it } from "vitest";

import { SAVED_KEY, knownSaved, parseSaved, readSaved, serializeSaved, toggleSavedId, writeSaved } from "./saved";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const blocked = {
  getItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("full", "QuotaExceededError");
  },
};

describe("saved places storage", () => {
  it("round-trips ids in the order they were saved, under a versioned key", () => {
    const storage = memoryStorage();
    expect(writeSaved(storage, ["la-taqueria", "trick-dog"])).toBe(true);
    expect(SAVED_KEY).toMatch(/:v\d+$/);
    expect([...storage.data.keys()]).toEqual([SAVED_KEY]);
    expect(readSaved(storage)).toEqual(["la-taqueria", "trick-dog"]);
    expect(parseSaved(serializeSaved(["a", "b", "a"]))).toEqual(["a", "b"]);
  });

  it("reads missing, corrupt, or wrongly shaped data as no saves", () => {
    expect(readSaved(memoryStorage())).toEqual([]);
    for (const raw of ["", "not json", "{", "null", "42", '"la-taqueria"', "[]", '{"ids":"la-taqueria"}', "{}"]) {
      expect(readSaved(memoryStorage({ [SAVED_KEY]: raw })), raw).toEqual([]);
    }
    expect(parseSaved('{"ids":["ok",3,null,"",{"id":"x"},"ok","also"]}')).toEqual(["ok", "also"]);
  });

  it("survives storage that throws (private mode, quota) and having no storage at all", () => {
    expect(readSaved(blocked)).toEqual([]);
    expect(writeSaved(blocked, ["la-taqueria"])).toBe(false);
    expect(readSaved(null)).toEqual([]);
    expect(writeSaved(undefined, ["la-taqueria"])).toBe(false);
  });

  it("drops saves for places taken out of the guide", () => {
    const known = new Set(["la-taqueria", "trick-dog"]);
    expect(knownSaved(["gone", "trick-dog", "also-gone", "la-taqueria"], known)).toEqual(["trick-dog", "la-taqueria"]);
  });

  it("toggles a place on at the end and off wherever it is", () => {
    expect(toggleSavedId([], "a")).toEqual(["a"]);
    expect(toggleSavedId(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(toggleSavedId(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});
