import { NextResponse } from "next/server";
import { createBooking } from "@/lib/store";
import { validateBookingInput } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = validateBookingInput(body);

  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  const created = await createBooking(result.data);
  if (!created.ok) {
    return NextResponse.json({ errors: { bookingDate: created.error } }, { status: 409 });
  }

  return NextResponse.json({ booking: created.booking }, { status: 201 });
}
