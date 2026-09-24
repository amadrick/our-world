import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { aiConfigured } from "@/lib/ai/summary";
import { buildPrompt, fallbackHint } from "@/lib/images/prompt.mjs";
import { renderImage, saveImage } from "@/lib/images/render.mjs";
import { firstIssue } from "@/lib/places/schema";
import { getPlaceStore } from "@/lib/storage";
import { badRequest, unauthorized } from "../../../guard";

const imageRequestSchema = z.object({
  visual: z.string().trim().max(400).optional(),
  scene: z.enum(["object", "room"]).optional(),
});

/** Draws the clay still of a place's signature subject and records it on the place. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/places/[id]/image">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "Illustrations need an OpenAI key. Add OPENAI_API_KEY, or run npm run images later." },
      { status: 503 },
    );
  }

  const parsed = imageRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return badRequest(firstIssue(parsed.error));

  const { id } = await ctx.params;
  const store = getPlaceStore();
  const place = await store.get(id);
  if (!place) {
    return NextResponse.json({ error: "That place no longer exists." }, { status: 404 });
  }

  const hint = { ...fallbackHint(place), ...(parsed.data.visual && parsed.data) };
  try {
    const image = await saveImage(await renderImage(buildPrompt(hint)), place.id);
    const { id: placeId, createdAt, updatedAt, ...input } = place;
    return NextResponse.json({ place: await store.update(placeId, { ...input, image }) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Image generation failed:", reason);
    return NextResponse.json(
      { error: `Couldn't draw the illustration (${reason}).` },
      { status: 502 },
    );
  }
}
