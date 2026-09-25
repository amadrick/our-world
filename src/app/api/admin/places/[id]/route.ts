import { NextResponse, type NextRequest } from "next/server";

import { PlaceNotFoundError, getPlaceStore } from "@/lib/storage";
import { unauthorized } from "../../guard";
import { parsePlaceInput } from "../../place-input";

function notFound() {
  return NextResponse.json(
    { error: "That place no longer exists. Refresh to see the latest list." },
    { status: 404 },
  );
}

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/admin/places/[id]">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const result = await parsePlaceInput(request);
  if ("error" in result) return result.error;

  try {
    return NextResponse.json({ place: await getPlaceStore().update(id, result.input) });
  } catch (error) {
    if (error instanceof PlaceNotFoundError) return notFound();
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/places/[id]">,
) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await getPlaceStore().remove(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PlaceNotFoundError) return notFound();
    throw error;
  }
}
