import type { Place, PlaceInput } from "@/lib/places/types";

/**
 * Where places live. The app only talks to this interface, so the JSON file
 * used today can be swapped for hosted storage (Vercel KV, Postgres, …)
 * without touching pages or API routes.
 */
export interface PlaceStore {
  list(): Promise<Place[]>;
  get(id: string): Promise<Place | null>;
  create(input: PlaceInput): Promise<Place>;
  update(id: string, input: PlaceInput): Promise<Place>;
  remove(id: string): Promise<void>;
}

export class PlaceNotFoundError extends Error {
  constructor(id: string) {
    super(`No place with id "${id}"`);
    this.name = "PlaceNotFoundError";
  }
}
