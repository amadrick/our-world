import { NextResponse, type NextRequest } from "next/server";

import { getPlaceStore } from "@/lib/storage";
import { unauthorized } from "../guard";
import { parsePlaceInput } from "../place-input";

export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const result = await parsePlaceInput(request);
  if ("error" in result) return result.error;

  const place = await getPlaceStore().create(result.input);
  return NextResponse.json({ place }, { status: 201 });
}
