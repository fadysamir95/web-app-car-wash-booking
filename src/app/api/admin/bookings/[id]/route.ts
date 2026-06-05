import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin";
import { updateBookingStatus } from "@/lib/store";
import { isBookingStatus, isPaymentStatus } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type Updates = {
  paymentStatus?: "Pending" | "Verified" | "Rejected";
  bookingStatus?: "Pending Payment" | "Payment Under Review" | "Confirmed" | "Scheduled" | "Completed" | "Cancelled";
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    paymentStatus?: string;
    bookingStatus?: string;
  } | null;
  const updates: Updates = {};

  if (body?.paymentStatus) {
    if (!isPaymentStatus(body.paymentStatus)) {
      return NextResponse.json({ error: "Invalid payment status." }, { status: 400 });
    }
    updates.paymentStatus = body.paymentStatus;
  }

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
