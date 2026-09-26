import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RoutingUnavailableError,
  fetchDriveTimes,
  formatDrive,
  metersBetween,
  orsMatrixBody,
  osrmTableUrl,
  parseOrsMatrix,
  parseOsrmTable,
  snapOrigin,
} from "./drive-times";

const origin = { lat: 37.7793, lng: -122.4193 };
const places = [
  { id: "la-taqueria", lat: 37.75087, lng: -122.41816 },
  { id: "coit-tower", lat: 37.80239, lng: -122.40582 },
];

describe("drive times", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks OSRM's table service for one row from the origin", () => {
    expect(osrmTableUrl(origin, places, "https://router.example/")).toBe(
      "https://router.example/table/v1/driving/-122.419300,37.779300;-122.418160,37.750870;-122.405820,37.802390?sources=0&annotations=duration",
    );
  });

  it("reads OSRM durations by place, skipping the origin column and unroutable places", () => {
    expect(parseOsrmTable({ code: "Ok", durations: [[0, 642.4, null]] }, places)).toEqual({ "la-taqueria": 642 });
    expect(() => parseOsrmTable({ code: "TooBig", message: "Too many table coordinates" }, places)).toThrow(
      RoutingUnavailableError,
    );
  });

  it("builds and reads an openrouteservice matrix", () => {
    expect(orsMatrixBody(origin, places)).toEqual({
      locations: [
        [-122.4193, 37.7793],
        [-122.41816, 37.75087],
        [-122.40582, 37.80239],
      ],
      sources: [0],
      destinations: [1, 2],
      metrics: ["duration"],
    });
    expect(parseOrsMatrix({ durations: [[610.2, 480.9]] }, places)).toEqual({ "la-taqueria": 610, "coit-tower": 481 });
    expect(() => parseOrsMatrix({ error: { message: "Access to this API has been disallowed" } }, places)).toThrow(
      "Access to this API has been disallowed",
    );
  });

  it("uses openrouteservice when a key is set, OSRM otherwise", async () => {
    const calls: [string, RequestInit][] = [];
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return Response.json(url.includes("openrouteservice") ? { durations: [[60, 120]] } : { code: "Ok", durations: [[0, 90, 180]] });
    });
    vi.stubGlobal("fetch", fetch);
    await expect(fetchDriveTimes(origin, places)).resolves.toEqual({
      service: "osrm",
      seconds: { "la-taqueria": 90, "coit-tower": 180 },
    });
    await expect(fetchDriveTimes(origin, places, { apiKey: "key" })).resolves.toEqual({
      service: "openrouteservice",
      seconds: { "la-taqueria": 60, "coit-tower": 120 },
    });
    expect((calls[1][1].headers as Record<string, string>).Authorization).toBe("key");
  });

  it("reports an unreachable router as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(fetchDriveTimes(origin, places)).rejects.toBeInstanceOf(RoutingUnavailableError);
  });

  it("says drive times in minutes, then hours", () => {
    expect(formatDrive(20)).toBe("1 min drive");
    expect(formatDrive(12 * 60 + 20)).toBe("12 min drive");
    expect(formatDrive(3600)).toBe("1 hr drive");
    expect(formatDrive(3600 + 25 * 60)).toBe("1 hr 25 min drive");
  });

  it("snaps origins to about 110 m and measures moves", () => {
    expect(snapOrigin({ lat: 37.77934, lng: -122.41926 })).toEqual({ lat: 37.779, lng: -122.419 });
    expect(metersBetween(origin, { lat: 37.7804, lng: -122.4193 })).toBeCloseTo(122, 0);
    expect(metersBetween(origin, origin)).toBe(0);
  });
});
