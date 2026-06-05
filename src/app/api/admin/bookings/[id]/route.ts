import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin";
import { deleteBookingData, updateBookingStatus } from "@/lib/store";
import { isBookingStatus } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type Updates = {
  bookingStatus?: "Pending" | "Confirmed" | "Completed" | "Cancelled";
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    bookingStatus?: string;
  } | null;
  const updates: Updates = {};

  if (body?.bookingStatus) {
    if (!isBookingStatus(body.bookingStatus)) {
      return NextResponse.json({ error: "Invalid booking status." }, { status: 400 });
    }
    updates.bookingStatus = body.bookingStatus;
  }

  const { id } = await context.params;
  const booking = await updateBookingStatus(id, updates);

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  return NextResponse.json({ booking });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const bookings = await deleteBookingData(id);

  if (!bookings) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  return NextResponse.json({ bookings });
}
