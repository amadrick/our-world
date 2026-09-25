import { readFile } from "node:fs/promises";
import path from "node:path";

type Ring = [number, number][];
interface NeighborhoodFeature {
  properties: { name: string };
  geometry: { type: "MultiPolygon"; coordinates: Ring[][] };
}

// SF Planning neighborhood names, shortened to what guests actually say.
const DISPLAY_NAMES: Record<string, string> = {
  "South of Market": "SoMa",
  "Downtown/Civic Center": "Civic Center",
  "Castro/Upper Market": "Castro",
  "Treasure Island/YBI": "Treasure Island",
  "Haight Ashbury": "Haight-Ashbury",
};

let features: Promise<NeighborhoodFeature[]> | undefined;

function load(): Promise<NeighborhoodFeature[]> {
  features ??= readFile(
    path.join(process.cwd(), "data", "sf-neighborhoods.json"),
    "utf8",
  ).then((raw) => JSON.parse(raw).features as NeighborhoodFeature[]);
  return features;
}

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Best-effort San Francisco neighborhood for a point; null outside the city. */
export async function neighborhoodAt(lat: number, lng: number): Promise<string | null> {
  try {
    for (const feature of await load()) {
      for (const [outer, ...holes] of feature.geometry.coordinates) {
        if (inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h))) {
          const name = feature.properties.name;
          return DISPLAY_NAMES[name] ?? name;
        }
      }
    }
  } catch (error) {
    console.error("Neighborhood lookup failed", error);
  }
  return null;
}
