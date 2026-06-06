import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin";
import { deleteBookingData, updateBookingStatus } from "@/lib/store";
import { isBookingStatus } from "@/lib/validation";
import { getWorkerById, recordWorkerWash } from "@/lib/workers";
import type { PublicWorker } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type Updates = {
  bookingStatus?: "Pending" | "Confirmed" | "Completed" | "Cancelled";
  completedByWorkerId?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    bookingStatus?: string;
    workerId?: string;
  } | null;
  const updates: Updates = {};

  if (body?.bookingStatus) {
    if (!isBookingStatus(body.bookingStatus)) {
      return NextResponse.json({ error: "Invalid booking status." }, { status: 400 });
    }
    updates.bookingStatus = body.bookingStatus;
  }

  let worker: PublicWorker | null = null;
  if (updates.bookingStatus === "Completed") {
    if (!body?.workerId) {
      return NextResponse.json({ error: "Worker is required for completed washes." }, { status: 400 });
    }
    const existingWorker = await getWorkerById(body.workerId);
    if (!existingWorker) {
      return NextResponse.json({ error: "Worker not found." }, { status: 400 });
    }
    updates.completedByWorkerId = body.workerId;
  }

  const { id } = await context.params;
  const booking = await updateBookingStatus(id, updates);

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (updates.bookingStatus === "Completed" && updates.completedByWorkerId) {
    worker = await recordWorkerWash(updates.completedByWorkerId);
  }

  return NextResponse.json({ booking, worker });
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
