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

/**
 * Uber's universal deep link: a ride from wherever the guest is to this place.
 * Opens the Uber app when installed and Uber's mobile web otherwise. The
 * bracketed keys are Uber's documented names; only the values are encoded.
 */
export function uberRideUrl(place: Pick<Place, "name" | "address" | "lat" | "lng">): string {
  const params: [string, string][] = [
    ["action", "setPickup"],
    ["pickup", "my_location"],
    ["dropoff[latitude]", String(place.lat)],
    ["dropoff[longitude]", String(place.lng)],
    ["dropoff[nickname]", place.name],
  ];
  if (place.address) params.push(["dropoff[formatted_address]", place.address]);
  // encodeURIComponent leaves ! ' ( ) * alone; a name like "Original Joe's" goes out fully escaped.
  const encode = (value: string) =>
    encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const query = params.map(([key, value]) => `${key}=${encode(value)}`).join("&");
  return `https://m.uber.com/ul/?${query}`;
}

/** Google's universal Maps URL: opens the Google Maps app when installed. */
export function googleMapsUrl(place: LinkablePlace): string {
  if (place.googleMapsUrl) return place.googleMapsUrl;
  const query = place.address ? `${place.name}, ${place.address}` : place.name;
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
