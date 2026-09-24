import { NextResponse, type NextRequest } from "next/server";

import { GeocoderUnavailableError, searchPlaces } from "@/lib/geo/geocoder";
import { extractUrl } from "@/lib/geo/maps-links";
import { LinkResolutionError, resolveMapsLink } from "@/lib/geo/resolve-link";
import { badRequest, unauthorized } from "../guard";

/** One box for everything: a place name to search, or a pasted Apple/Google Maps link. */
export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { input?: unknown } | null;
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  if (input.length < 2) return badRequest("Type at least two characters.");
  if (input.length > 2000) return badRequest("That's too long to search for.");

  if (extractUrl(input)) {
    try {
      const link = await resolveMapsLink(input);
      return NextResponse.json({
        kind: "link",
        provider: link.provider,
        url: link.url,
        candidates: link.candidates,
      });
    } catch (error) {
      if (error instanceof LinkResolutionError) return badRequest(error.message);
      throw error;
    }
  }

  try {
    return NextResponse.json({ kind: "search", candidates: await searchPlaces(input) });
  } catch (error) {
    if (error instanceof GeocoderUnavailableError) {
      return NextResponse.json(
        {
          error:
            "Place search can't be reached right now. Paste an Apple Maps or Google Maps link instead.",
        },
        { status: 503 },
      );
    }
    throw error;
  }
}
