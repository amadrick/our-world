import { describe, expect, it } from "vitest";

import { DRIVE_CALIBRATION, estimateTravel, formatTravel, formatTravelShort, trafficPeriod } from "./travel-estimate";

// September 2026 is Pacific Daylight Time; the 29th is a Tuesday, the 27th a Sunday.
const at = (iso: string) => new Date(`${iso}-07:00`);

describe("travel estimates", () => {
  it("names the traffic period in San Francisco", () => {
    expect(trafficPeriod(at("2026-09-29T08:30:00"))).toBe("peak");
    expect(trafficPeriod(at("2026-09-29T12:00:00"))).toBe("day");
    expect(trafficPeriod(at("2026-09-29T17:30:00"))).toBe("peak");
    expect(trafficPeriod(at("2026-09-29T21:30:00"))).toBe("night");
    expect(trafficPeriod(at("2026-09-27T17:30:00"))).toBe("day");
    expect(trafficPeriod(at("2026-09-28T02:00:00"))).toBe("night");
  });

  it("scales free-flow router times by the period and adds the allowance", () => {
    // 10 free-flow minutes: 1.55 × 10 + 5 = 20.5 at midday, 23.5 in the rush, 16 at night.
    expect(estimateTravel(600, 5000, "day")).toEqual({ mode: "drive", minutes: 21 });
    expect(estimateTravel(600, 5000, "peak")).toEqual({ mode: "drive", minutes: 24 });
    expect(estimateTravel(600, 5000, "night")).toEqual({ mode: "drive", minutes: 16 });
    const { factor, allowanceMin } = DRIVE_CALIBRATION.day;
    expect(estimateTravel(348, undefined, "day").minutes).toBe(Math.round(5.8 * factor + allowanceMin));
  });

  it("matches the reference trips it was calibrated on, within a few minutes", () => {
    // Our OSRM minutes and Google Maps' driving minutes, measured Sep 27–28, 2026.
    const trips: [osrm: number, night: number, noon: number, rush: number][] = [
      [5.8, 10, 14, 16], // Union Square → Ferry Building
      [8.5, 14, 18, 20], // Union Square → Sully's (Marina)
      [19.5, 27, 35, 35], // Union Square → Outerlands (Sunset)
      [8.4, 15, 18, 20], // Mission → Arsicault (Richmond)
      [18.6, 26, 35, 40], // Outer Sunset → SFMOMA
    ];
    for (const [osrm, night, noon, rush] of trips) {
      expect(Math.abs(estimateTravel(osrm * 60, 5000, "night").minutes - night)).toBeLessThanOrEqual(2);
      expect(Math.abs(estimateTravel(osrm * 60, 5000, "day").minutes - noon)).toBeLessThanOrEqual(4);
      expect(Math.abs(estimateTravel(osrm * 60, 5000, "peak").minutes - rush)).toBeLessThanOrEqual(6);
    }
  });

  it("quotes a short hop as a walk, at Google's walking pace", () => {
    expect(estimateTravel(120, 480, "day")).toEqual({ mode: "walk", minutes: 6 });
    expect(estimateTravel(30, 40, "day")).toEqual({ mode: "walk", minutes: 1 });
    expect(estimateTravel(200, 1000, "day").mode).toBe("drive");
  });

  it("always reads as an estimate", () => {
    expect(formatTravel({ mode: "drive", minutes: 12 })).toBe("~12 min drive");
    expect(formatTravel({ mode: "walk", minutes: 6 })).toBe("~6 min walk");
    expect(formatTravel({ mode: "drive", minutes: 75 })).toBe("~1 hr 15 min drive");
    expect(formatTravelShort({ mode: "drive", minutes: 9 })).toBe("~9 min");
  });
});
