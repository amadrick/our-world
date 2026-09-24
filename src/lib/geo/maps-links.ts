export type MapsProvider = "apple" | "google";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ParsedMapsLink {
  provider: MapsProvider;
  /** Exact location of the place, when the link pins one. */
  position?: LatLng;
  /** Map center or search area: useful as a search bias, not as the place itself. */
  near?: LatLng;
  name?: string;
  address?: string;
  query?: string;
}

const APPLE_HOST = /^(maps\.apple\.com|maps\.apple|collections\.apple\.com)$/i;
const GOOGLE_HOST = /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/i;
const SHORT_GOOGLE_HOST = /^(maps\.app\.goo\.gl|goo\.gl)$/i;

/** Pulls the first link out of pasted text (share sheets add the name and address around it). */
export function extractUrl(text: string): { url: string; rest: string } | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  const url = match[0].replace(/[),.;]+$/, "");
  const rest = text.replace(match[0], " ").trim();
  return { url, rest };
}

export function mapsProvider(url: URL): MapsProvider | null {
  const host = url.hostname.toLowerCase();
  if (APPLE_HOST.test(host)) return "apple";
  if (SHORT_GOOGLE_HOST.test(host)) return "google";
  if (GOOGLE_HOST.test(host) && (host.startsWith("maps.") || url.pathname.startsWith("/maps"))) {
    return "google";
  }
  return null;
}

/** Short links carry no location themselves and must be expanded by following redirects. */
export function isShortMapsLink(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  if (host === "maps.apple" || host === "maps.apple.com") {
    return /^\/p\//.test(url.pathname);
  }
  return false;
}

export function parseLatLng(value: string | null | undefined): LatLng | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return undefined;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment.replace(/\+/g, " ")).trim();
  } catch {
    return segment.replace(/\+/g, " ").trim();
  }
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseApple(url: URL): ParsedMapsLink {
  const p = url.searchParams;
  const result: ParsedMapsLink = { provider: "apple" };

  result.position = parseLatLng(p.get("coordinate")) ?? parseLatLng(p.get("ll"));
  result.near = parseLatLng(p.get("sll")) ?? parseLatLng(p.get("center"));

  const q = clean(p.get("q"));
  const qPosition = parseLatLng(q);
  if (qPosition) result.position ??= qPosition;
  else if (q) result.name = q;

  result.name = clean(p.get("name")) ?? result.name;
  result.address = clean(p.get("address")) ?? clean(p.get("daddr"));

  if (!result.position && !result.name && result.address) {
    result.query = result.address;
  }
  return result;
}

function parseGoogle(url: URL): ParsedMapsLink {
  const p = url.searchParams;
  const result: ParsedMapsLink = { provider: "google" };
  const path = url.pathname;

  const placeMatch = path.match(/\/maps\/place\/([^/]+)/);
  if (placeMatch) {
    const label = decodeSegment(placeMatch[1]);
    const labelPosition = parseLatLng(label);
    if (labelPosition) result.position = labelPosition;
    else {
      // "/place/Tartine+Bakery,+600+Guerrero+St,+San+Francisco" → name + address
      const [name, ...address] = label.split(",").map((s) => s.trim());
      result.name = name;
      if (address.length) result.address = address.join(", ");
    }
  }

  const searchMatch = path.match(/\/maps\/search\/([^/]+)/);
  if (searchMatch) {
    const label = decodeSegment(searchMatch[1]);
    const labelPosition = parseLatLng(label);
    if (labelPosition) result.position = labelPosition;
    else result.query = label;
  }

  // The data blob holds the pin itself: …!3d37.7614!4d-122.4241
  const pin = [...path.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)].pop();
  if (pin) result.position = { lat: Number(pin[1]), lng: Number(pin[2]) };

  const viewport = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (viewport) result.near = { lat: Number(viewport[1]), lng: Number(viewport[2]) };

  const q = clean(p.get("q")) ?? clean(p.get("query")) ?? clean(p.get("destination"));
  const qPosition = parseLatLng(q);
  if (qPosition) result.position ??= qPosition;
  else if (q && !result.name) result.query = q;

  const ll = parseLatLng(p.get("ll")) ?? parseLatLng(p.get("center"));
  if (ll) result.near ??= ll;

  return result;
}

/** Parses a full Apple Maps or Google Maps URL. Returns null for anything else. */
export function parseMapsUrl(raw: string): ParsedMapsLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const provider = mapsProvider(url);
  if (provider === "apple") return parseApple(url);
  if (provider === "google") return parseGoogle(url);
  return null;
}
