import { NextResponse } from "next/server";
import { readBookings, readSettings } from "@/lib/store";
import { normalizePhone } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = String(body?.message || "").trim();
  const settings = await readSettings();

  if (!message) {
    return NextResponse.json({ answer: "Ask me about booking, prices, payment, rewards, referrals, or your booking status." });
  }

  const lower = message.toLowerCase();
  const phone = normalizePhone(message);
  const reference = message.toUpperCase().match(/CW-[A-Z0-9]{6}/)?.[0];

  if (reference || /^01[0125]\d{8}$/.test(phone)) {
    const bookings = await readBookings();
    const booking = bookings.find((item) => item.id === reference || item.phoneNumber === phone);
    if (booking) {
      return NextResponse.json({
        answer: `Booking ${booking.id}: ${booking.bookingStatus}. Date: ${booking.bookingDate}. Area: ${booking.areaName || booking.area}.`
      });
    }
  }

  if (lower.includes("price") || lower.includes("cost") || lower.includes("سعر")) {
    const minPrice = Math.min(...settings.areas.filter((area) => area.active).map((area) => area.priceEgp), settings.servicePriceEgp);
    return NextResponse.json({ answer: `Service prices start from ${minPrice} EGP depending on the selected area.` });
  }

  if (lower.includes("payment") || lower.includes("instapay") || lower.includes("دفع") || lower.includes("تحويل")) {
    return NextResponse.json({ answer: `After submitting a booking, payment instructions appear on the confirmation page. Payment number: ${settings.paymentPhone}.` });
  }

  if (lower.includes("reward") || lower.includes("points") || lower.includes("loyalty") || lower.includes("نقاط")) {
    return NextResponse.json({ answer: "Every completed wash earns 10 points. 100 points can be redeemed for one free wash." });
  }

  if (lower.includes("referral") || lower.includes("invite") || lower.includes("دعوة")) {
    return NextResponse.json({ answer: "Referral rewards: your friend gets 25 EGP off and you earn a 25 EGP referral reward when they use your code." });
  }

  if (lower.includes("time") || lower.includes("موعد")) {
    return NextResponse.json({ answer: `Vehicle washing window: ${settings.washWindow}. Booking closes when the wash day starts at 12:00 AM.` });
  }

  return NextResponse.json({
    answer: "I can help with bookings, pricing, payment instructions, booking status, rewards, and referrals. Share your booking reference or phone number for status."
  });
}
