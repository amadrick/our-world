import { describe, expect, it } from "vitest";

import { formatClock, hoursLine, localClock, openState, type PlaceHours } from "./hours";

// September 2026 is Pacific Daylight Time (UTC-7). The 27th is a Sunday.
const at = (iso: string) => new Date(`${iso}-07:00`);

const bar: PlaceHours = {
  status: "listed",
  weekly: {
    sun: [["12:00", "02:00"]],
    mon: [],
    tue: [["16:00", "02:00"]],
    wed: [["16:00", "02:00"]],
    thu: [["16:00", "02:00"]],
    fri: [["16:00", "02:00"]],
    sat: [["12:00", "02:00"]],
  },
};

const splitLunchDinner: PlaceHours = {
  status: "listed",
  weekly: {
    sun: [],
    mon: [["11:30", "14:00"], ["17:30", "22:00"]],
    tue: [["11:30", "14:00"], ["17:30", "22:00"]],
    wed: [["11:30", "14:00"], ["17:30", "22:00"]],
    thu: [["11:30", "14:00"], ["17:30", "22:00"]],
    fri: [["11:30", "14:00"], ["17:30", "23:00"]],
    sat: [["17:30", "23:00"]],
  },
};

describe("opening hours", () => {
  it("reads the clock in San Francisco, whatever the machine's zone", () => {
    expect(localClock(new Date("2026-09-27T15:30:00Z"))).toEqual({ day: 0, minutes: 8 * 60 + 30 });
    // 01:00 UTC Monday is still Sunday evening in SF.
    expect(localClock(new Date("2026-09-28T01:00:00Z"))).toEqual({ day: 0, minutes: 18 * 60 });
  });

  it("keeps a bar open past midnight into the next day", () => {
    // Saturday 1:30 AM belongs to Friday's 4 PM–2 AM.
    expect(openState(bar, at("2026-09-26T01:30:00"))).toMatchObject({ kind: "open", closesIn: 30 });
    expect(hoursLine(openState(bar, at("2026-09-26T01:30:00")), at("2026-09-26T01:30:00"))).toBe(
      "Closing soon · closes 2 AM",
    );
    // Saturday 11 PM: Saturday's own opening, closing at 2 AM Sunday.
    expect(openState(bar, at("2026-09-26T23:00:00"))).toMatchObject({ kind: "open", closesIn: 180, closesAt: { day: 0, minutes: 120 } });
  });

  it("rolls over the week: Sunday night into Monday, and a closed Monday", () => {
    // Monday 1 AM is still Sunday's noon–2 AM.
    expect(openState(bar, at("2026-09-28T01:00:00"))).toMatchObject({ kind: "open", closesIn: 60 });
    // Monday 3 AM: closed all Monday, opens Tuesday 4 PM.
    const monday = at("2026-09-28T03:00:00");
    expect(openState(bar, monday)).toMatchObject({ kind: "closed", opensAt: { day: 2, minutes: 16 * 60 } });
    expect(hoursLine(openState(bar, monday), monday)).toBe("Closed · opens tomorrow 4 PM");
    // Sunday 3 AM: closed, opens at noon the same day.
    const sunday = at("2026-09-27T03:00:00");
    expect(hoursLine(openState(bar, sunday), sunday)).toBe("Closed · opens noon");
  });

  it("handles a split day and says when it opens next", () => {
    const monday3pm = at("2026-09-28T15:00:00");
    expect(openState(splitLunchDinner, monday3pm)).toMatchObject({ kind: "closed", opensIn: 150 });
    expect(hoursLine(openState(splitLunchDinner, monday3pm), monday3pm)).toBe("Closed · opens 5:30 PM");
    const monday8pm = at("2026-09-28T20:00:00");
    expect(hoursLine(openState(splitLunchDinner, monday8pm), monday8pm)).toBe("Open now · closes 10 PM");
    // Saturday 11:30 PM: next is Monday lunch.
    const lateSat = at("2026-09-26T23:30:00");
    expect(hoursLine(openState(splitLunchDinner, lateSat), lateSat)).toBe("Closed · opens Mon 11:30 AM");
    // Sunday evening: tomorrow.
    const sundayNight = at("2026-09-27T20:00:00");
    expect(hoursLine(openState(splitLunchDinner, sundayNight), sundayNight)).toBe("Closed · opens tomorrow 11:30 AM");
  });

  it("treats back-to-back openings as one, and a full week as always open", () => {
    const allDay: PlaceHours = {
      status: "listed",
      weekly: Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, [["00:00", "00:00"]]])) as PlaceHours["weekly"],
    };
    expect(openState(allDay, at("2026-09-27T12:00:00"))).toEqual({ kind: "always" });
    const lateThenEarly: PlaceHours = {
      status: "listed",
      weekly: { sun: [], mon: [["20:00", "00:00"]], tue: [["00:00", "03:00"]], wed: [], thu: [], fri: [], sat: [] },
    };
    // Monday 11 PM: open until 3 AM, across the midnight seam.
    expect(openState(lateThenEarly, at("2026-09-28T23:00:00"))).toMatchObject({ kind: "open", closesIn: 240 });
  });

  it("never guesses: unknown, always, and closed for good", () => {
    const now = at("2026-09-27T12:00:00");
    expect(openState(undefined, now)).toEqual({ kind: "unknown" });
    expect(openState({ status: "unknown" }, now)).toEqual({ kind: "unknown" });
    expect(openState({ status: "always" }, now)).toEqual({ kind: "always" });
    expect(openState({ ...bar, closedPermanently: true }, now)).toEqual({ kind: "unknown" });
    expect(hoursLine({ kind: "unknown" }, now)).toBe("Hours unknown");
    expect(hoursLine({ kind: "always" }, now)).toBe("Open 24 hours");
  });

  it("writes times the way people say them", () => {
    expect(formatClock(0)).toBe("midnight");
    expect(formatClock(12 * 60)).toBe("noon");
    expect(formatClock(7 * 60)).toBe("7 AM");
    expect(formatClock(22 * 60 + 30)).toBe("10:30 PM");
  });
});
