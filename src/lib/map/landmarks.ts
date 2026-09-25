/**
 * San Francisco's landmarks and hills, placed by hand: the tiles miss some
 * (Coit Tower) and name others inconsistently. `rank` 1 shows from the city
 * view, 2 from the neighborhood view. `sight` is the guide's own place for it:
 * while that place's pin is on the map, the basemap leaves this one out.
 */
export interface Landmark {
  name: string;
  kind: "landmark" | "hill";
  rank: 1 | 2;
  lng: number;
  lat: number;
  sight?: string;
}

export const LANDMARKS: Landmark[] = [
  { name: "Golden Gate Bridge", kind: "landmark", rank: 1, lng: -122.4783, lat: 37.8199, sight: "golden-gate-bridge" },
  { name: "Coit Tower", kind: "landmark", rank: 1, lng: -122.4058, lat: 37.8024, sight: "coit-tower" },
  { name: "Painted Ladies", kind: "landmark", rank: 1, lng: -122.4329, lat: 37.7762, sight: "painted-ladies" },
  { name: "Palace of Fine Arts", kind: "landmark", rank: 1, lng: -122.4484, lat: 37.8029, sight: "palace-of-fine-arts" },
  { name: "Ferry Building", kind: "landmark", rank: 1, lng: -122.3937, lat: 37.7955, sight: "ferry-building" },
  { name: "Alcatraz", kind: "landmark", rank: 1, lng: -122.423, lat: 37.8267, sight: "alcatraz" },
  { name: "Sutro Tower", kind: "landmark", rank: 2, lng: -122.4528, lat: 37.7552 },
  { name: "Transamerica Pyramid", kind: "landmark", rank: 2, lng: -122.4028, lat: 37.7952, sight: "transamerica-pyramid" },
  { name: "Lombard Street", kind: "landmark", rank: 2, lng: -122.4187, lat: 37.8021, sight: "lombard-street" },
  { name: "Mission Dolores", kind: "landmark", rank: 2, lng: -122.4269, lat: 37.7642 },
  { name: "City Hall", kind: "landmark", rank: 2, lng: -122.4193, lat: 37.7793, sight: "city-hall" },
  { name: "Conservatory of Flowers", kind: "landmark", rank: 2, lng: -122.4602, lat: 37.7726 },
  { name: "Sutro Baths", kind: "landmark", rank: 2, lng: -122.5138, lat: 37.7804, sight: "lands-end-sutro-baths" },
  { name: "Fort Point", kind: "landmark", rank: 2, lng: -122.4771, lat: 37.8106 },
  { name: "Twin Peaks", kind: "hill", rank: 1, lng: -122.4477, lat: 37.7527, sight: "twin-peaks" },
  { name: "Mount Davidson", kind: "hill", rank: 1, lng: -122.4541, lat: 37.7383 },
  { name: "Mount Sutro", kind: "hill", rank: 2, lng: -122.4577, lat: 37.7587 },
  { name: "Bernal Heights", kind: "hill", rank: 1, lng: -122.4146, lat: 37.743 },
  { name: "Telegraph Hill", kind: "hill", rank: 2, lng: -122.4063, lat: 37.8016 },
  { name: "Corona Heights", kind: "hill", rank: 2, lng: -122.4382, lat: 37.7651 },
  { name: "Buena Vista Park", kind: "hill", rank: 2, lng: -122.4413, lat: 37.7683 },
  { name: "Lone Mountain", kind: "hill", rank: 2, lng: -122.4516, lat: 37.7787 },
  { name: "Tank Hill", kind: "hill", rank: 2, lng: -122.4476, lat: 37.7597 },
  { name: "Strawberry Hill", kind: "hill", rank: 2, lng: -122.4757, lat: 37.7685 },
];

export function landmarkCollection(onMap: ReadonlySet<string> = new Set()): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: LANDMARKS.filter((l) => !l.sight || !onMap.has(l.sight)).map((l) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [l.lng, l.lat] },
      properties: { name: l.name, kind: l.kind, rank: l.rank },
    })),
  };
}
