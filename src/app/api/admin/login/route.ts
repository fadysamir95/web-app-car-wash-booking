import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";
import { ADMIN_IDLE_TIMEOUT_SECONDS, createAdminCsrfToken, createAdminToken, verifyAdminPassword } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);

  if (!rate.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  if (!body?.password || !(await verifyAdminPassword(body.password))) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const sessionToken = createAdminToken();
  const response = NextResponse.json({ ok: true, csrfToken: createAdminCsrfToken(sessionToken) });
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_IDLE_TIMEOUT_SECONDS,
    path: "/"
  });
  return response;
}
