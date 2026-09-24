import type { PlaceCandidate } from "@/lib/geo/geocoder";
import type { MapsProvider } from "@/lib/geo/maps-links";
import type { PlaceInputPayload } from "@/lib/places/schema";
import type { Place, SummarySource } from "@/lib/places/types";

export type { PlaceCandidate };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Something went wrong. Try again.");
  return body;
}

export interface LookupResult {
  kind: "search" | "link";
  provider?: MapsProvider;
  url?: string;
  candidates: PlaceCandidate[];
}

export function lookupPlace(input: string, signal?: AbortSignal) {
  return request<LookupResult>("/api/admin/lookup", {
    method: "POST",
    body: JSON.stringify({ input }),
    signal,
  });
}

export interface SummaryResponse {
  summary: string;
  source: Extract<SummarySource, "ai" | "placeholder">;
  notice?: string;
}

export function requestSummary(payload: PlaceInputPayload) {
  return request<SummaryResponse>("/api/admin/summary", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface SignatureResponse {
  signatureSubject?: string;
  visual?: string;
  scene?: "object" | "room";
  source: "ai" | "none";
  notice?: string;
}

export function researchSignature(payload: {
  name: string;
  category?: string;
  neighborhood: string;
  address: string;
}) {
  return request<SignatureResponse>("/api/admin/signature", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** What the illustration should show, from signature research. */
export interface ImageHint {
  visual?: string;
  scene?: "object" | "room";
}

export async function generatePlaceImage(id: string, hint: ImageHint = {}): Promise<Place> {
  const { place } = await request<{ place: Place }>(
    `/api/admin/places/${encodeURIComponent(id)}/image`,
    { method: "POST", body: JSON.stringify(hint) },
  );
  return place;
}

export async function savePlace(payload: PlaceInputPayload, id?: string): Promise<Place> {
  const { place } = await request<{ place: Place }>(
    id ? `/api/admin/places/${encodeURIComponent(id)}` : "/api/admin/places",
    { method: id ? "PUT" : "POST", body: JSON.stringify(payload) },
  );
  return place;
}

export async function deletePlace(id: string): Promise<void> {
  await request(`/api/admin/places/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function signIn(password: string): Promise<void> {
  await request("/api/admin/session", { method: "POST", body: JSON.stringify({ password }) });
}

export async function signOut(): Promise<void> {
  await request("/api/admin/session", { method: "DELETE" });
}
