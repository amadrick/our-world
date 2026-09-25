import { NextResponse, type NextRequest } from "next/server";

import { aiConfigured } from "@/lib/ai/summary";
import { buildPrompt } from "@/lib/images/prompt.mjs";
import {
  IMAGE_GENERATION_OFF,
  imageGenerationEnabled,
  renderImage,
  sampleImageColor,
  saveImage,
} from "@/lib/images/render.mjs";
import { getPlaceStore } from "@/lib/storage";
import { unauthorized } from "../../../guard";

/** Draws the place's image from Andy's prompt and its research notes, and records it on the place. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/places/[id]/image">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  if (!imageGenerationEnabled()) {
    return NextResponse.json({ error: IMAGE_GENERATION_OFF }, { status: 503 });
  }
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "Place images need an OpenAI key. Add OPENAI_API_KEY, or run npm run images later." },
      { status: 503 },
    );
  }

  const { id } = await ctx.params;
  const store = getPlaceStore();
  const place = await store.get(id);
  if (!place) {
    return NextResponse.json({ error: "That place no longer exists." }, { status: 404 });
  }

  let prompt: string;
  try {
    prompt = buildPrompt(place);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 422 });
  }
  try {
    const rendered = await renderImage(prompt);
    const [image, imageColor] = await Promise.all([
      saveImage(rendered, place.id),
      sampleImageColor(rendered),
    ]);
    const { id: placeId, createdAt, updatedAt, ...input } = place;
    return NextResponse.json({ place: await store.update(placeId, { ...input, image, imageColor }) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Image generation failed:", reason);
    return NextResponse.json(
      { error: `Couldn't draw the image (${reason}).` },
      { status: 502 },
    );
  }
}
