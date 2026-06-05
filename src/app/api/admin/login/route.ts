import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";
import { createAdminToken, verifyAdminPassword } from "@/lib/admin";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;

  if (!body?.password || !verifyAdminPassword(body.password)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/"
  });
  return response;
}
