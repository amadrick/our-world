import { NextResponse, type NextRequest } from "next/server";

import { researchPlace } from "@/lib/ai/place-research.mjs";
import { firstIssue, placeInputSchema } from "@/lib/places/schema";
import { badRequest, unauthorized } from "../guard";

const researchRequestSchema = placeInputSchema
  .pick({ name: true, category: true, neighborhood: true, address: true, lat: true, lng: true })
  .partial({ category: true, lat: true, lng: true });

/** What the place is known for and what it physically looks like, for the add form. */
export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const parsed = researchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(firstIssue(parsed.error));

  return NextResponse.json(await researchPlace(parsed.data));
}
