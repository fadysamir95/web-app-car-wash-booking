import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { addBookingComplaint } from "@/lib/store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(`complaint:${ip}`, 5, 15 * 60 * 1000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { complaint?: string } | null;
  const text = body?.complaint?.trim().slice(0, 700) || "";
  if (text.length < 10) {
    return NextResponse.json({ error: "Complaint is too short." }, { status: 400 });
  }

  const { id } = await context.params;
  const booking = await addBookingComplaint(id, { text, createdAt: new Date().toISOString() });
  if (!booking) {
    return NextResponse.json({ error: "Complaint is only available after a low rating." }, { status: 400 });
  }

  return NextResponse.json({ booking });
}
