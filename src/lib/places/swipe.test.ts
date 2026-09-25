import { describe, expect, it } from "vitest";

import { filterPlaces, sortPlaces } from "./filters";
import { lockAxis, placeNeighbors, rubberBand, swipeOffset, swipeOutcome } from "./swipe";
import type { Place } from "./types";

const place = (id: string, extra: Partial<Place> = {}) =>
  ({ id, name: id, category: "restaurant", tags: [], lat: 37.76, lng: -122.42, ...extra }) as Place;

describe("placeNeighbors: the order", () => {
  const order = [place("a"), place("b"), place("c")];

  it("steps through the list in its order", () => {
    const { prev, next, index } = placeNeighbors(order, "b");
    expect([prev?.id, next?.id, index]).toEqual(["a", "c", 1]);
  });

  it("follows the filtered list, the same order List view shows", () => {
    const places = [
      place("zuni", { name: "Zuni Café", neighborhood: "Hayes Valley" }),
      place("arsicault", { name: "Arsicault Bakery", neighborhood: "Inner Richmond", category: "bakery" }),
      place("tartine", { name: "Tartine Bakery", neighborhood: "Mission", category: "bakery" }),
      place("beit-rima", { name: "Beit Rima", neighborhood: "Cole Valley" }),
    ];
    const bakeries = filterPlaces(sortPlaces(places), {
      category: "bakery",
      pills: [],
      neighborhood: null,
    });
    const ids = bakeries.map((p) => p.id);
    const { prev, next } = placeNeighbors(bakeries, ids[0]);
    expect(prev).toBeNull();
    expect(next?.id).toBe(ids[1]);
    expect(ids).not.toContain("zuni");
  });

  it("starts a place missing from the list at the list's start", () => {
    expect(placeNeighbors(order, "hidden")).toMatchObject({ prev: null, next: order[0], index: -1 });
  });
});

describe("placeNeighbors: the ends", () => {
  const order = [place("a"), place("b"), place("c")];

  it("has no previous before the first and no next after the last, without wrapping", () => {
    expect(placeNeighbors(order, "a").prev).toBeNull();
    expect(placeNeighbors(order, "c").next).toBeNull();
  });

  it("has nowhere to go in a list of one", () => {
    expect(placeNeighbors([place("a")], "a")).toMatchObject({ prev: null, next: null });
  });

  it("won't step past an end, however hard the swipe", () => {
    expect(swipeOutcome({ dx: -300, velocity: -2, width: 390, hasPrev: true, hasNext: false })).toBe(0);
    expect(swipeOutcome({ dx: 300, velocity: 2, width: 390, hasPrev: false, hasNext: true })).toBe(0);
  });

  it("rubber-bands past an end: follows a little, with growing resistance, never past the limit", () => {
    const width = 390;
    const small = swipeOffset(-40, width, true, false);
    const big = swipeOffset(-400, width, true, false);
    expect(small).toBeLessThan(0);
    expect(Math.abs(small)).toBeLessThan(40);
    expect(Math.abs(big)).toBeLessThan(width);
    expect(Math.abs(big) / 400).toBeLessThan(Math.abs(small) / 40);
    expect(rubberBand(1e6, width)).toBeLessThanOrEqual(width);
  });

  it("follows the finger freely toward a neighbor", () => {
    expect(swipeOffset(-120, 390, false, true)).toBe(-120);
    expect(swipeOffset(80, 390, true, false)).toBe(80);
  });
});

describe("swipeOutcome: snapping", () => {
  const base = { width: 390, hasPrev: true, hasNext: true };

  it("steps by distance: left to the next, right to the previous", () => {
    expect(swipeOutcome({ ...base, dx: -120, velocity: 0 })).toBe(1);
    expect(swipeOutcome({ ...base, dx: 120, velocity: 0 })).toBe(-1);
  });

  it("steps on a quick flick even when short", () => {
    expect(swipeOutcome({ ...base, dx: -40, velocity: -0.8 })).toBe(1);
  });

  it("springs back from a short, slow drag, or a flick against the drag", () => {
    expect(swipeOutcome({ ...base, dx: -40, velocity: -0.1 })).toBe(0);
    expect(swipeOutcome({ ...base, dx: -60, velocity: 0.9 })).toBe(0);
  });
});

describe("lockAxis", () => {
  it("waits until the pointer has moved far enough to tell", () => {
    expect(lockAxis(4, 3)).toBeNull();
  });

  it("locks horizontal drags to x, for stepping", () => {
    expect(lockAxis(24, 6)).toBe("x");
    expect(lockAxis(-30, 10)).toBe("x");
  });

  it("locks vertical drags to y, so scrolling and the sheet never turn into a step", () => {
    expect(lockAxis(5, 24)).toBe("y");
    expect(lockAxis(-8, -40)).toBe("y");
  });

  it("gives a clearly diagonal drag to vertical", () => {
    expect(lockAxis(22, 21)).toBe("y");
    expect(lockAxis(11, 10)).toBeNull();
  });
});
