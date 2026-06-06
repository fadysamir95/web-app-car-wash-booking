import { NextResponse } from "next/server";
import { WORKER_SESSION_COOKIE } from "@/lib/constants";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(WORKER_SESSION_COOKIE);
  return response;
}
