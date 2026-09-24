import { NextResponse, type NextRequest } from "next/server";

import { researchSignature } from "@/lib/ai/signature";
import { firstIssue, placeInputSchema } from "@/lib/places/schema";
import { badRequest, unauthorized } from "../guard";

const signatureRequestSchema = placeInputSchema
  .pick({ name: true, category: true, neighborhood: true, address: true })
  .partial({ category: true });

export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const parsed = signatureRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(firstIssue(parsed.error));

  return NextResponse.json(await researchSignature(parsed.data));
}
