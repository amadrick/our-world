/**
 * Driving times from one origin to every place, from a real router: one matrix
 * request with the origin as the only source. OSRM's public server needs no key;
 * with ROUTING_API_KEY set, openrouteservice's matrix is used instead.
 */

export interface Origin {
  lat: number;
  lng: number;
}

export interface Destination {
  id: string;
  lat: number;
  lng: number;
}

export type RoutingService = "osrm" | "openrouteservice";

export class RoutingUnavailableError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "RoutingUnavailableError";
  }
}

const OSRM_URL = "https://router.project-osrm.org";
const ORS_URL = "https://api.openrouteservice.org/v2/matrix/driving-car";
const USER_AGENT = "SF-Recs/1.0 (wedding guide drive times)";
const TIMEOUT_MS = 8000;

/** Origins are snapped to about 110 m, so nearby readers share a cached answer. */
export function snapOrigin({ lat, lng }: Origin): Origin {
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 };
}

/** Great-circle distance in meters. Only for deciding when the reader has moved, never for a drive time. */
export function metersBetween(a: Origin, b: Origin): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function osrmTableUrl(origin: Origin, destinations: Destination[], base = OSRM_URL): string {
  const coords = [origin, ...destinations].map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  return `${base.replace(/\/$/, "")}/table/v1/driving/${coords}?sources=0&annotations=duration,distance`;
}

/** Seconds (or meters) by place id. Places the router can't reach are left out. */
function durationsById(row: unknown, destinations: Destination[], offset: number): Record<string, number> {
  if (!Array.isArray(row)) return {};
  const out: Record<string, number> = {};
  destinations.forEach((d, i) => {
    const seconds = row[i + offset];
    if (typeof seconds === "number" && Number.isFinite(seconds)) out[d.id] = Math.round(seconds);
  });
  return out;
}

export interface RouteTable {
  /** Free-flow driving time, by place id. */
  seconds: Record<string, number>;
  /** Driving distance by road, by place id. */
  meters: Record<string, number>;
}

export function parseOsrmTable(body: unknown, destinations: Destination[]): RouteTable {
  const table = body as { code?: string; message?: string; durations?: unknown[]; distances?: unknown[] } | null;
  if (table?.code !== "Ok") throw new RoutingUnavailableError(table?.message ?? "The router refused the request");
  if (!Array.isArray(table.durations?.[0])) throw new RoutingUnavailableError("The router sent no durations");
  // Row 0 is the origin; column 0 is the origin to itself.
  return {
    seconds: durationsById(table.durations[0], destinations, 1),
    meters: durationsById(table.distances?.[0], destinations, 1),
  };
}

export function orsMatrixBody(origin: Origin, destinations: Destination[]) {
  return {
    locations: [origin, ...destinations].map((p) => [p.lng, p.lat]),
    sources: [0],
    destinations: destinations.map((_, i) => i + 1),
    metrics: ["duration", "distance"],
  };
}

export function parseOrsMatrix(body: unknown, destinations: Destination[]): RouteTable {
  const matrix = body as { durations?: unknown[]; distances?: unknown[]; error?: { message?: string } | string } | null;
  if (!Array.isArray(matrix?.durations?.[0])) {
    const error = typeof matrix?.error === "string" ? matrix.error : matrix?.error?.message;
    throw new RoutingUnavailableError(error ?? "The router sent no durations");
  }
  // ORS reports distance in meters by default.
  return { seconds: durationsById(matrix.durations[0], destinations, 0), meters: durationsById(matrix.distances?.[0], destinations, 0) };
}

async function request(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (error) {
    throw new RoutingUnavailableError("The router can't be reached", error);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok && !body) throw new RoutingUnavailableError(`The router answered ${response.status}`);
  return body;
}

export async function fetchDriveTimes(
  origin: Origin,
  destinations: Destination[],
  env: { apiKey?: string; osrmUrl?: string } = {},
): Promise<{ service: RoutingService } & RouteTable> {
  if (destinations.length === 0) return { service: env.apiKey ? "openrouteservice" : "osrm", seconds: {}, meters: {} };
  if (env.apiKey) {
    const body = await request(ORS_URL, {
      method: "POST",
      headers: { Authorization: env.apiKey, "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify(orsMatrixBody(origin, destinations)),
    });
    return { service: "openrouteservice", ...parseOrsMatrix(body, destinations) };
  }
  const body = await request(osrmTableUrl(origin, destinations, env.osrmUrl), {
    headers: { "User-Agent": USER_AGENT },
  });
  return { service: "osrm", ...parseOsrmTable(body, destinations) };
}
