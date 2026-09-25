import type { CategoryId } from "@/lib/places/types";
import type { LatLng } from "./maps-links";
import { neighborhoodAt } from "./neighborhoods";

export interface PlaceCandidate {
  key: string;
  name: string;
  address: string;
  neighborhood: string;
  lat: number;
  lng: number;
  category?: CategoryId;
  /** e.g. "Bakery", "Viewpoint" — shown to help tell similar results apart. */
  kind?: string;
}

export class GeocoderUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Place search is unavailable right now", { cause });
    this.name = "GeocoderUnavailableError";
  }
}

const SF_CENTER: LatLng = { lat: 37.7749, lng: -122.4194 };
const USER_AGENT = "SF-Recs/1.0 (wedding guide admin place search)";
const TIMEOUT_MS = 6000;

const CATEGORY_BY_OSM: Record<string, Record<string, CategoryId>> = {
  amenity: {
    restaurant: "restaurant",
    fast_food: "restaurant",
    food_court: "restaurant",
    bar: "bar",
    pub: "bar",
    biergarten: "bar",
    nightclub: "bar",
    cafe: "coffee",
    ice_cream: "dessert",
    theatre: "activity",
    cinema: "activity",
    arts_centre: "activity",
  },
  shop: {
    bakery: "bakery",
    coffee: "coffee",
    tea: "coffee",
    pastry: "bakery",
    confectionery: "dessert",
    chocolate: "dessert",
    wine: "wine",
    clothes: "shop",
    boutique: "shop",
    shoes: "shop",
    jewelry: "shop",
    books: "shop",
    perfumery: "shop",
    cosmetics: "shop",
    gift: "shop",
    houseware: "shop",
    pottery: "shop",
    furniture: "shop",
    second_hand: "shop",
  },
  tourism: {
    viewpoint: "sight",
    attraction: "sight",
    artwork: "sight",
    museum: "activity",
    gallery: "activity",
    zoo: "activity",
    aquarium: "activity",
    theme_park: "activity",
  },
  leisure: {
    park: "activity",
    garden: "activity",
    nature_reserve: "activity",
    marina: "activity",
    sauna: "activity",
  },
  historic: { monument: "sight", memorial: "sight", building: "sight" },
  man_made: { bridge: "sight", tower: "sight", lighthouse: "sight", pier: "activity" },
  natural: { peak: "sight", beach: "activity" },
};

function suggestCategory(key?: string, value?: string): CategoryId | undefined {
  if (!key || !value) return undefined;
  return CATEGORY_BY_OSM[key]?.[value] ?? (key === "historic" ? "sight" : undefined);
}

function humanize(value?: string): string | undefined {
  if (!value || value === "yes") return undefined;
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatAddress(parts: {
  housenumber?: string;
  street?: string;
  city?: string;
}): string {
  const line = [parts.housenumber, parts.street].filter(Boolean).join(" ");
  return [line, parts.city].filter(Boolean).join(", ");
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return (await res.json()) as T;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    locality?: string;
  };
}

async function photonSearch(query: string, near: LatLng): Promise<PlaceCandidate[]> {
  const params = new URLSearchParams({
    q: query,
    lat: String(near.lat),
    lon: String(near.lng),
    zoom: "12",
    location_bias_scale: "0.4",
    limit: "8",
    lang: "en",
  });
  const data = await getJson<{ features: PhotonFeature[] }>(
    `https://photon.komoot.io/api/?${params}`,
  );
  return Promise.all(
    data.features
      .filter((f) => f.properties.name || f.properties.street)
      .map(async (f) => {
        const p = f.properties;
        const [lng, lat] = f.geometry.coordinates;
        return {
          key: `photon:${p.osm_type}${p.osm_id}`,
          name: p.name ?? formatAddress(p),
          address: formatAddress(p),
          neighborhood:
            (await neighborhoodAt(lat, lng)) ?? p.district ?? p.locality ?? "",
          lat,
          lng,
          category: suggestCategory(p.osm_key, p.osm_value),
          kind: humanize(p.osm_value),
        };
      }),
  );
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
}

async function nominatimSearch(query: string, near: LatLng): Promise<PlaceCandidate[]> {
  const d = 0.35;
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8",
    viewbox: `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
    bounded: "0",
  });
  const data = await getJson<NominatimResult[]>(
    `https://nominatim.openstreetmap.org/search?${params}`,
  );
  return Promise.all(
    data.map(async (r) => {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      const a = r.address ?? {};
      return {
        key: `nominatim:${r.place_id}`,
        name: r.name || r.display_name.split(",")[0],
        address: formatAddress({
          housenumber: a.house_number,
          street: a.road,
          city: a.city ?? a.town ?? a.village,
        }),
        neighborhood:
          (await neighborhoodAt(lat, lng)) ?? a.neighbourhood ?? a.suburb ?? "",
        lat,
        lng,
        category: suggestCategory(r.category, r.type),
        kind: humanize(r.type),
      };
    }),
  );
}

/** Finds places by name, biased toward San Francisco. Tries Photon, then Nominatim. */
export async function searchPlaces(
  query: string,
  near: LatLng = SF_CENTER,
): Promise<PlaceCandidate[]> {
  const errors: unknown[] = [];
  for (const search of [photonSearch, nominatimSearch]) {
    try {
      return await search(query, near);
    } catch (error) {
      errors.push(error);
    }
  }
  throw new GeocoderUnavailableError(errors);
}

export interface ReverseResult {
  address: string;
  neighborhood: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseResult> {
  const neighborhood = (await neighborhoodAt(lat, lng)) ?? "";
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), lang: "en" });
    const data = await getJson<{ features: PhotonFeature[] }>(
      `https://photon.komoot.io/reverse?${params}`,
    );
    const p = data.features[0]?.properties;
    if (p) {
      return {
        address: formatAddress(p),
        neighborhood: neighborhood || p.district || p.locality || "",
      };
    }
  } catch {
    // Offline or rate limited: the admin can type the address in.
  }
  return { address: "", neighborhood };
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
