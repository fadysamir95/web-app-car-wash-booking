import { NextResponse } from "next/server";
import { createOtp } from "@/lib/otp";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/validation";

const egyptPhonePattern = /^01[0125]\d{8}$/;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const body = (await request.json().catch(() => null)) as { phoneNumber?: string } | null;
  const phoneNumber = normalizePhone(body?.phoneNumber || "");

  if (!egyptPhonePattern.test(phoneNumber)) {
    return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
  }

  const rate = checkRateLimit(`otp:${ip}:${phoneNumber}`, 5, 15 * 60 * 1000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many OTP requests." }, { status: 429 });
  }

  const code = await createOtp(phoneNumber);

  return NextResponse.json({
    ok: true,
    devCode: process.env.NODE_ENV === "production" ? undefined : code
  });
}
