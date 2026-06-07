import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { activePromoCodes, createBooking, customerLoyaltyBalance, readBookings, readPromoCodes, readSettings } from "@/lib/store";
import { normalizePhone, validateBookingInput } from "@/lib/validation";
import { consumeOtpToken, verifyOtpToken } from "@/lib/otp";
import { readWorkers } from "@/lib/workers";

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
    .filter((booking) => booking.id.toUpperCase() === normalizedReference || booking.phoneNumber === normalizedPhone);
  const balancePhone = normalizedPhone || matches[0]?.phoneNumber || "";
  const loyaltyBalance = balancePhone ? customerLoyaltyBalance(bookings, balancePhone) : 0;
  const workers = await readWorkers();
  const enrichedMatches = matches.map((booking) => {
    const worker = booking.completedByWorkerId ? workers.find((item) => item.id === booking.completedByWorkerId) : null;
    return {
      ...booking,
      completedByWorkerName: booking.completedByWorkerName || worker?.name
    };
  });

  return NextResponse.json({ bookings: enrichedMatches, loyaltyBalance });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(ip);

  if (!rate.ok) {
    return NextResponse.json({ errors: { form: "Too many booking attempts. Please try again later." } }, { status: 429 });
  }

  const [promos, settings] = await Promise.all([readPromoCodes(), readSettings()]);
  const result = validateBookingInput(body, activePromoCodes(promos), settings);

  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  const phoneRate = checkRateLimit(`booking-phone:${result.data.phoneNumber}`, 5, 30 * 60 * 1000);
  const pairRate = checkRateLimit(`booking-pair:${ip}:${result.data.phoneNumber}`, 3, 15 * 60 * 1000);
  if (!phoneRate.ok || !pairRate.ok) {
    return NextResponse.json({ errors: { form: "Too many bookings from this phone number. Please try again later." } }, { status: 429 });
  }

  const otpToken = typeof body === "object" && body !== null && "otpToken" in body ? String((body as { otpToken?: unknown }).otpToken || "") : "";
  if (!(await verifyOtpToken(result.data.phoneNumber, otpToken))) {
    return NextResponse.json({ errors: { otp: "Verify your phone number before booking." } }, { status: 400 });
  }

  const created = await createBooking(result.data);
  if (!created.ok) {
    return NextResponse.json({ errors: { [created.field || "bookingDate"]: created.error } }, { status: 409 });
  }

  await consumeOtpToken(result.data.phoneNumber, otpToken);
  return NextResponse.json({ booking: created.booking }, { status: 201 });
}
