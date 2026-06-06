import { NextResponse } from "next/server";
import { rateBooking } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(`rating:${ip}`, 10, 15 * 60 * 1000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { rating?: number; ratingComment?: string } | null;
  const rating = Number(body?.rating || 0);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Invalid rating." }, { status: 400 });
  }

  const { id } = await context.params;
  const booking = await rateBooking(id, rating, typeof body?.ratingComment === "string" ? body.ratingComment.slice(0, 300) : undefined);
  if (!booking) {
    return NextResponse.json({ error: "Booking is not ready for rating." }, { status: 400 });
  }

  return NextResponse.json({ booking });
}
