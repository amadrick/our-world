import { connection } from "next/server";

import { Explorer } from "@/components/explorer/explorer";
import { getPlaceStore } from "@/lib/storage";
import type { Place } from "@/lib/places/types";

/** Research notes feed the admin and the picture prompts; guests never see them, so they stay off the page. */
function forGuests({ placeResearch: _research, signatureRationale: _rationale, ...place }: Place): Place {
  return place;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const [places, params] = await Promise.all([getPlaceStore().list(), searchParams]);
  const placeId = typeof params.place === "string" ? params.place : null;

  return <Explorer places={places.map(forGuests)} initialPlaceId={placeId} />;
}
