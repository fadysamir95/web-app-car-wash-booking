import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin";
import { deleteAllBookingData, readBookings } from "@/lib/store";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const bookings = await readBookings();
  return NextResponse.json({ bookings });
}

export async function DELETE() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const bookings = await deleteAllBookingData();
  return NextResponse.json({ bookings });
}
