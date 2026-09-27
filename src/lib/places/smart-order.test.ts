import { describe, expect, it } from "vitest";

import { dayPartAt, dayPartFit } from "./day-parts";
import type { PlaceHours, Weekday } from "./hours";
import { groupBySection, orderPlaces } from "./smart-order";
import type { Place } from "./types";

const at = (iso: string) => new Date(`${iso}-07:00`);
const days: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const every = (open: string, close: string): PlaceHours => ({
  status: "listed",
  weekly: Object.fromEntries(days.map((d) => [d, [[open, close]]])) as PlaceHours["weekly"],
});

let n = 0;
function place(name: string, category: Place["category"], hours: PlaceHours | undefined, extra: Partial<Place> = {}): Place {
  n += 1;
  return {
    id: name.toLowerCase().replace(/\W+/g, "-"),
    name,
    category,
    neighborhood: "Mission",
    address: "",
    lat: 37.76,
    lng: -122.42 + n * 0.0001,
    tags: [],
    summary: "",
    summarySource: "written",
    createdAt: "2026-09-27T00:00:00.000Z",
    hours,
    ...extra,
  };
}

const coffee = place("Coffee", "coffee", every("07:00", "15:00"));
const bakery = place("Bakery", "bakery", every("06:30", "14:00"));
const dinner = place("Dinner", "restaurant", every("17:00", "22:00"), { tags: ["dinner"] });
const bar = place("Bar", "bar", every("16:00", "02:00"));
const lateBar = place("Late Bar", "bar", every("12:00", "02:00"), { tags: ["late-night"] });
const shop = place("Shop", "shop", every("11:00", "19:00"));
const mystery = place("Mystery", "restaurant", { status: "unknown" });
const beach = place("Beach", "park", { status: "always" });
const all = [coffee, bakery, dinner, bar, lateBar, shop, mystery, beach];
const names = (list: { place: Place }[]) => list.map((r) => r.place.name);

describe("day parts", () => {
  it("names the part of the day in San Francisco", () => {
    expect(dayPartAt(at("2026-09-27T06:00:00"))).toBe("early");
    expect(dayPartAt(at("2026-09-27T08:30:00"))).toBe("morning");
    expect(dayPartAt(at("2026-09-27T12:30:00"))).toBe("midday");
    expect(dayPartAt(at("2026-09-27T16:00:00"))).toBe("afternoon");
    expect(dayPartAt(at("2026-09-27T19:00:00"))).toBe("evening");
    expect(dayPartAt(at("2026-09-27T22:30:00"))).toBe("late");
    expect(dayPartAt(at("2026-09-28T01:30:00"))).toBe("late");
  });

  it("scores coffee for mornings, dinner for evenings, bars for late", () => {
    expect(dayPartFit(coffee, "morning")).toBe(3);
    expect(dayPartFit(coffee, "late")).toBe(0);
    expect(dayPartFit(dinner, "evening")).toBe(3);
    expect(dayPartFit(dinner, "morning")).toBe(0);
    expect(dayPartFit(bar, "late")).toBe(3);
    // A tag can lift a category: a restaurant tagged late night fits late.
    expect(dayPartFit(place("Diner", "restaurant", undefined, { tags: ["late-night"] }), "late")).toBe(3);
  });
});

describe("Smart order", () => {
  it("puts open, well-suited places first in the morning, unknown after open, closed last", () => {
    const ranked = orderPlaces(all, "smart", { now: at("2026-09-27T08:30:00") });
    // Coffee and Bakery suit the morning equally; Bakery is nearer Union Square. Closed ones by soonest opening.
    expect(names(ranked)).toEqual(["Bakery", "Coffee", "Beach", "Mystery", "Shop", "Late Bar", "Bar", "Dinner"]);
    expect(groupBySection(ranked).map((g) => [g.id, g.items.length])).toEqual([
      ["good", 3],
      ["unknown", 1],
      ["closed", 4],
    ]);
  });

  it("leads with bars late at night, and ranks a place closing soon below the rest", () => {
    // 10:30 PM: the dinner spot has closed; the bars are open until 2.
    const late = orderPlaces(all, "smart", { now: at("2026-09-27T22:30:00") });
    expect(names(late).slice(0, 3)).toEqual(["Late Bar", "Bar", "Beach"]);
    expect(late.find((r) => r.place.name === "Dinner")?.section).toBe("closed");
    // 1:30 AM: both bars close at 2, so the always-open beach comes first.
    const closing = orderPlaces(all, "smart", { now: at("2026-09-28T01:30:00") });
    expect(names(closing).slice(0, 3)).toEqual(["Beach", "Late Bar", "Bar"]);
  });

  it("breaks ties by distance: from the reader when located, from the city center otherwise", () => {
    const near = place("Near Coffee", "coffee", every("07:00", "15:00"), { lat: 37.8, lng: -122.44 });
    const far = place("Far Coffee", "coffee", every("07:00", "15:00"), { lat: 37.74, lng: -122.5 });
    const morning = at("2026-09-27T08:30:00");
    expect(names(orderPlaces([far, near], "smart", { now: morning, origin: { lat: 37.8, lng: -122.44 } }))).toEqual([
      "Near Coffee",
      "Far Coffee",
    ]);
    expect(names(orderPlaces([near, far], "smart", { now: morning, origin: { lat: 37.74, lng: -122.5 } }))).toEqual([
      "Far Coffee",
      "Near Coffee",
    ]);
    // No location: Union Square is closer to "Near Coffee".
    expect(names(orderPlaces([far, near], "smart", { now: morning }))).toEqual(["Near Coffee", "Far Coffee"]);
  });

  it("nudges a favorite ahead of an equal place, never across open and closed", () => {
    const morning = at("2026-09-27T08:30:00");
    const plain = place("Plain Coffee", "coffee", every("07:00", "15:00"), { lat: 37.788, lng: -122.4075 });
    const loved = place("Loved Coffee", "coffee", every("07:00", "15:00"), { lat: 37.75, lng: -122.45, favorite: true });
    const lovedButClosed = place("Loved Closed", "coffee", every("12:00", "15:00"), { favorite: true });
    expect(names(orderPlaces([plain, loved, lovedButClosed], "smart", { now: morning }))).toEqual([
      "Loved Coffee",
      "Plain Coffee",
      "Loved Closed",
    ]);
  });

  it("offers A–Z and Nearest", () => {
    const now = at("2026-09-27T08:30:00");
    expect(names(orderPlaces(all, "az", { now }))).toEqual([...all.map((p) => p.name)].sort((a, b) => a.localeCompare(b)));
    const ranked = orderPlaces(all, "nearest", { now, origin: { lat: 37.76, lng: -122.42 } });
    const meters = ranked.map((r) => r.meters);
    expect(meters).toEqual([...meters].sort((a, b) => a - b));
  });
});
