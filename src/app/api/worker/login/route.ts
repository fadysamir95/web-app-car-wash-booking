import { NextResponse } from "next/server";
import { WORKER_SESSION_COOKIE } from "@/lib/constants";
import { createWorkerToken } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { findWorkerByPassword, publicWorker } from "@/lib/workers";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(`worker-login:${ip}`, 5, 15 * 60 * 1000);

  if (!rate.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const worker = body?.password ? await findWorkerByPassword(body.password) : null;
  if (!worker) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, worker: publicWorker(worker) });
  response.cookies.set(WORKER_SESSION_COOKIE, createWorkerToken(worker.id), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/"
  });
  return response;
}
