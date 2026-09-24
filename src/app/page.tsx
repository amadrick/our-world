import { connection } from "next/server";

import { Explorer } from "@/components/explorer/explorer";
import { getPlaceStore } from "@/lib/storage";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const [places, params] = await Promise.all([getPlaceStore().list(), searchParams]);
  const placeId = typeof params.place === "string" ? params.place : null;

  return <Explorer places={places} initialPlaceId={placeId} />;
}
