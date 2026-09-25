import {
  GeocoderUnavailableError,
  distanceMeters,
  reverseGeocode,
  searchPlaces,
  type PlaceCandidate,
} from "./geocoder";
import {
  extractUrl,
  isShortMapsLink,
  mapsProvider,
  parseMapsUrl,
  type MapsProvider,
} from "./maps-links";

export interface ResolvedLink {
  provider: MapsProvider;
  /** The link exactly as pasted; saved so the guest button opens the same place card. */
  url: string;
  candidates: PlaceCandidate[];
}

export class LinkResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkResolutionError";
  }
}

// Only these hosts are ever fetched, so pasted links can't be used to probe other servers.
const REDIRECT_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
  "maps.apple",
  "maps.apple.com",
]);

async function expandShortLink(start: URL): Promise<URL> {
  let current = start;
  for (let hop = 0; hop < 5; hop++) {
    if (!REDIRECT_HOSTS.has(current.hostname.toLowerCase())) return current;
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SF-Recs/1.0)" },
      cache: "no-store",
    });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return current;
    current = new URL(location, current);
    if (!isShortMapsLink(current)) return current;
  }
  return current;
}

export async function resolveMapsLink(text: string): Promise<ResolvedLink> {
  const extracted = extractUrl(text);
  if (!extracted) throw new LinkResolutionError("That doesn't look like a link.");

  let url: URL;
  try {
    url = new URL(extracted.url);
  } catch {
    throw new LinkResolutionError("That link looks incomplete.");
  }
  const provider = mapsProvider(url);
  if (!provider) {
    throw new LinkResolutionError("Paste a link from Apple Maps or Google Maps.");
  }

  // Share sheets often put the place name on the line before the link.
  const hint = extracted.rest.split("\n").map((l) => l.trim()).find(Boolean);

  let target = url;
  if (isShortMapsLink(url)) {
    try {
      target = await expandShortLink(url);
    } catch {
      if (!hint) {
        throw new LinkResolutionError(
          "Couldn't open that short link from here. Try searching by name instead.",
        );
      }
    }
  }

  const parsed = parseMapsUrl(target.toString()) ?? { provider };
  const name = parsed.name ?? hint;

  if (parsed.position) {
    const { lat, lng } = parsed.position;
    let match: PlaceCandidate | undefined;
    if (name) {
      try {
        const results = await searchPlaces(name, parsed.position);
        match = results.find((r) => distanceMeters(r, parsed.position!) < 150);
      } catch {
        // Search is optional here: the link already has the location.
      }
    }
    const reverse = match ? null : await reverseGeocode(lat, lng);
    return {
      provider,
      url: extracted.url,
      candidates: [
        {
          key: `link:${lat},${lng}`,
          name: name ?? match?.name ?? "",
          address: parsed.address ?? match?.address ?? reverse?.address ?? "",
          neighborhood: match?.neighborhood ?? reverse?.neighborhood ?? "",
          lat,
          lng,
          category: match?.category,
          kind: match?.kind,
        },
      ],
    };
  }

  const query = [name ?? parsed.query, parsed.name ? parsed.address : undefined]
    .filter(Boolean)
    .join(", ");
  if (!query) {
    throw new LinkResolutionError(
      "That link doesn't include a location. Try searching by name instead.",
    );
  }
  try {
    return { provider, url: extracted.url, candidates: await searchPlaces(query, parsed.near) };
  } catch (error) {
    if (error instanceof GeocoderUnavailableError) {
      throw new LinkResolutionError(
        "Found the place name in the link, but place search is unavailable right now.",
      );
    }
    throw error;
  }
}
