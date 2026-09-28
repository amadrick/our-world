/**
 * Turns the router's free-flow car times into honest estimates. OSRM (and
 * openrouteservice) drive at posted speeds with no traffic or signals, which
 * runs well short in San Francisco, so each time is scaled by the part of the
 * day and given a fixed allowance. Short hops become a walk.
 *
 * Calibrated Sep 27–28, 2026 against Google Maps driving times for 11 pairs
 * across the city (Union Square, the Mission, Bernal, the Marina, and the
 * Outer Sunset to the Ferry Building, the Marina, the Sunset, the Presidio,
 * the Richmond, North Beach, SoMa). Fits of Google = factor × OSRM + allowance:
 *   Sunday 9:30 PM (light traffic)   1.14 × + 4.6 min, mean error 0.7 min
 *   Tuesday noon                     1.54 × + 5.3 min, mean error 1.3 min
 *   Tuesday 5:30 PM                  1.54 × + 8.4 min, mean error 2.6 min
 * Raw OSRM ran at 40–65% of Google's time. Tune the table below.
 */
import { localClock } from "@/lib/places/hours";

export type TrafficPeriod = "night" | "day" | "peak";

export const DRIVE_CALIBRATION: Record<TrafficPeriod, { factor: number; allowanceMin: number }> = {
  /** 8 PM to 7 AM, every day. */
  night: { factor: 1.15, allowanceMin: 4.5 },
  /** Daytime outside the weekday rush, and weekend days. */
  day: { factor: 1.55, allowanceMin: 5 },
  /** Weekdays 7–10 AM and 3:30–7 PM. */
  peak: { factor: 1.55, allowanceMin: 8 },
};

/** A trip shorter than this by road is quoted as a walk. */
export const WALK_UNDER_METERS = 1000;
/** Google Maps' walking pace, about 4.8 km/h. */
export const WALK_METERS_PER_MIN = 80;

export function trafficPeriod(now: Date): TrafficPeriod {
  const { day, minutes } = localClock(now);
  const h = minutes / 60;
  if (h >= 20 || h < 7) return "night";
  const weekday = day >= 1 && day <= 5;
  if (weekday && ((h >= 7 && h < 10) || (h >= 15.5 && h < 19))) return "peak";
  return "day";
}

export interface TravelEstimate {
  mode: "drive" | "walk";
  minutes: number;
}

/** From the router's car seconds and road meters, what to tell the reader at this time of day. */
export function estimateTravel(seconds: number, meters: number | undefined, period: TrafficPeriod): TravelEstimate {
  if (meters !== undefined && meters < WALK_UNDER_METERS) {
    return { mode: "walk", minutes: Math.max(1, Math.round(meters / WALK_METERS_PER_MIN)) };
  }
  const { factor, allowanceMin } = DRIVE_CALIBRATION[period];
  return { mode: "drive", minutes: Math.max(1, Math.round((seconds / 60) * factor + allowanceMin)) };
}

const minutesText = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} hr${rest ? ` ${rest} min` : ""}`;
};

/** "12 min drive", "6 min walk". */
export function formatTravel({ mode, minutes }: TravelEstimate): string {
  return `${minutesText(minutes)} ${mode}`;
}

/** "12 min", where a glyph already says drive or walk. */
export function formatTravelShort({ minutes }: TravelEstimate): string {
  return minutesText(minutes);
}
