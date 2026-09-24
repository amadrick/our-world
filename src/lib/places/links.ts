import type { Place } from "./types";

type LinkablePlace = Pick<
  Place,
  "name" | "address" | "lat" | "lng" | "appleMapsUrl" | "googleMapsUrl"
>;

/** Opens the Maps app on iPhone/Mac, and the Apple Maps website elsewhere. */
export function appleMapsUrl(place: LinkablePlace): string {
  if (place.appleMapsUrl) return place.appleMapsUrl;
  const params = new URLSearchParams({
    q: place.name,
    ll: `${place.lat},${place.lng}`,
  });
  if (place.address) params.set("address", place.address);
  return `https://maps.apple.com/?${params.toString()}`;
}

/** Google's universal Maps URL: opens the Google Maps app when installed. */
export function googleMapsUrl(place: LinkablePlace): string {
  if (place.googleMapsUrl) return place.googleMapsUrl;
  const query = place.address ? `${place.name}, ${place.address}` : place.name;
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
