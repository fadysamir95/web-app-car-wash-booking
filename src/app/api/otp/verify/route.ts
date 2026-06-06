import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/validation";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const body = (await request.json().catch(() => null)) as { phoneNumber?: string; code?: string } | null;
  const phoneNumber = normalizePhone(body?.phoneNumber || "");
  const code = String(body?.code || "").replace(/\D/g, "");

  const rate = checkRateLimit(`otp-verify:${ip}:${phoneNumber}`, 8, 15 * 60 * 1000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many OTP attempts." }, { status: 429 });
  }

  const token = await verifyOtp(phoneNumber, code);
  if (!token) {
    return NextResponse.json({ error: "Invalid OTP." }, { status: 400 });
  }

  return NextResponse.json({ token });
}
