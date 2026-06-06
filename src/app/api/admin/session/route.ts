import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";
import { ADMIN_IDLE_TIMEOUT_SECONDS, createAdminToken, isAdminAuthenticated } from "@/lib/admin";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_IDLE_TIMEOUT_SECONDS,
    path: "/"
  });
  return response;
}
