import { NextResponse, type NextRequest } from "next/server";

import { generateSummary } from "@/lib/ai/summary";
import { firstIssue, placeInputSchema } from "@/lib/places/schema";
import { badRequest, unauthorized } from "../guard";

const summaryRequestSchema = placeInputSchema.pick({
  name: true,
  category: true,
  neighborhood: true,
  address: true,
  tags: true,
  note: true,
});

export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const parsed = summaryRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(firstIssue(parsed.error));

  return NextResponse.json(await generateSummary(parsed.data));
}
