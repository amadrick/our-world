import type { NextRequest, NextResponse } from "next/server";

import { generateSummary } from "@/lib/ai/summary";
import { firstIssue, placeInputSchema } from "@/lib/places/schema";
import type { PlaceInput } from "@/lib/places/types";
import { badRequest } from "./guard";

export async function parsePlaceInput(
  request: NextRequest,
): Promise<{ input: PlaceInput } | { error: NextResponse }> {
  const parsed = placeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { error: badRequest(firstIssue(parsed.error)) };

  const input: PlaceInput = parsed.data;
  // Saving without a summary still gives guests something to read.
  if (!input.summary) {
    const result = await generateSummary(input);
    input.summary = result.summary;
    input.summarySource = result.source;
  }
  return { input };
}
