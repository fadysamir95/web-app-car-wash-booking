import { NextResponse } from "next/server";
import { WORKER_SESSION_COOKIE } from "@/lib/constants";
import { createWorkerToken, verifyWorkerPassword } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(`worker-login:${ip}`, 5, 15 * 60 * 1000);

  if (!rate.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  if (!body?.password || !verifyWorkerPassword(body.password)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(WORKER_SESSION_COOKIE, createWorkerToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/"
  });
  return response;
}
