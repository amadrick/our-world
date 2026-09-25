import { NextResponse, type NextRequest } from "next/server";

import { isAdminRequest } from "@/lib/auth";

export function unauthorized(request: NextRequest): NextResponse | null {
  if (isAdminRequest(request)) return null;
  return NextResponse.json(
    { error: "Your admin session has ended. Sign in again." },
    { status: 401 },
  );
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
