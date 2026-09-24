import path from "node:path";

import { JsonPlaceStore } from "./json-place-store";
import type { PlaceStore } from "./place-store";

export { PlaceNotFoundError, type PlaceStore } from "./place-store";

let store: PlaceStore | undefined;

export function getPlaceStore(): PlaceStore {
  store ??= new JsonPlaceStore(
    process.env.PLACES_FILE ?? path.join(process.cwd(), "data", "places.json"),
  );
  return store;
}
