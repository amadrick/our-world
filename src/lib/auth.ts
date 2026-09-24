import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "sf_recs_admin";
export const DEFAULT_ADMIN_PASSWORD = "goldengate";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

export function usingDefaultPassword(): boolean {
  return !process.env.ADMIN_PASSWORD;
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Derived from the password, so changing ADMIN_PASSWORD signs everyone out.
function sessionToken(): string {
  return createHmac("sha256", adminPassword())
    .update("sf-recs-admin-session:v1")
    .digest("hex");
}

export function checkPassword(candidate: string): boolean {
  return safeEqual(candidate, adminPassword());
}

export const sessionCookie = {
  name: ADMIN_COOKIE,
  value: () => sessionToken(),
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  },
};

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(value && safeEqual(value, sessionToken()));
}

export function isAdminRequest(request: NextRequest): boolean {
  const value = request.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(value && safeEqual(value, sessionToken()));
}
