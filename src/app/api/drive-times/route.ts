import { NextResponse, type NextRequest } from "next/server";

import { RoutingUnavailableError, fetchDriveTimes, snapOrigin, type Origin } from "@/lib/geo/drive-times";
import { getPlaceStore } from "@/lib/storage";

const CACHE_MS = 60 * 60 * 1000;
const CACHE_LIMIT = 500;
/** Answers by snapped origin. The router is a shared public service, so it's asked once per spot and hour. */
const cache = new Map<string, { at: number; body: object }>();

function readOrigin(params: URLSearchParams): Origin | null {
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!params.get("lat") || !params.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return snapOrigin({ lat, lng });
}

/** Driving time in seconds from ?lat&lng to every place, by place id. */
export async function GET(request: NextRequest) {
  const origin = readOrigin(request.nextUrl.searchParams);
  if (!origin) return NextResponse.json({ error: "Pass lat and lng." }, { status: 400 });

  const key = `${origin.lat},${origin.lng}`;
  const hit = cache.get(key);
  const headers = { "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" };
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.body, { headers });

  const places = await getPlaceStore().list();
  try {
    const { service, seconds } = await fetchDriveTimes(
      origin,
      places.map(({ id, lat, lng }) => ({ id, lat, lng })),
      { apiKey: process.env.ROUTING_API_KEY || undefined, osrmUrl: process.env.ROUTING_OSRM_URL || undefined },
    );
    const body = { origin, service, seconds };
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body, { headers });
  } catch (error) {
    if (!(error instanceof RoutingUnavailableError)) throw error;
    console.error("Drive times unavailable:", error.message, error.cause ?? "");
    return NextResponse.json({ error: "Drive times are unavailable right now." }, { status: 502 });
  }
}
