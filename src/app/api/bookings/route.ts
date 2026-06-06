import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { activePromoCodes, createBooking, readBookings, readPromoCodes } from "@/lib/store";
import { normalizePhone, validateBookingInput } from "@/lib/validation";
import { consumeOtpToken } from "@/lib/otp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "";

  if (query.length < 3) {
    return NextResponse.json({ bookings: [] });
  }

  const normalizedPhone = normalizePhone(query);
  const normalizedReference = query.toUpperCase();
  const bookings = await readBookings();
  const matches = bookings
    .filter((booking) => booking.id.toUpperCase() === normalizedReference || booking.phoneNumber === normalizedPhone)
    .slice(0, 10);

  return NextResponse.json({ bookings: matches });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(ip);

  if (!rate.ok) {
    return NextResponse.json({ errors: { form: "Too many booking attempts. Please try again later." } }, { status: 429 });
  }

  const result = validateBookingInput(body, activePromoCodes(await readPromoCodes()));

  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  const otpToken = typeof body === "object" && body !== null && "otpToken" in body ? String((body as { otpToken?: unknown }).otpToken || "") : "";
  if (!consumeOtpToken(result.data.phoneNumber, otpToken)) {
    return NextResponse.json({ errors: { otp: "Verify your phone number before booking." } }, { status: 400 });
  }

  const created = await createBooking(result.data);
  if (!created.ok) {
    return NextResponse.json({ errors: { bookingDate: created.error } }, { status: 409 });
  }

  return NextResponse.json({ booking: created.booking }, { status: 201 });
}
