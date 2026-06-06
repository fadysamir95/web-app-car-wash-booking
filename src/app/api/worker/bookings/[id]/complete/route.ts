import { NextResponse } from "next/server";
import { isWorkerAuthenticated } from "@/lib/admin";
import { updateBookingStatus } from "@/lib/store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  if (!(await isWorkerAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const booking = await updateBookingStatus(id, { bookingStatus: "Completed" });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  return NextResponse.json({ booking });
}
