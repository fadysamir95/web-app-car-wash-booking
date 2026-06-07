import { NextResponse } from "next/server";
import { isAdminAuthenticated, verifyAdminCsrf, verifyAdminPassword } from "@/lib/admin";
import { deleteAllBookingData, readBookings } from "@/lib/store";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const bookings = await readBookings();
  return NextResponse.json({ bookings });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await verifyAdminCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { currentPassword?: string } | null;
  if (!body?.currentPassword || !(await verifyAdminPassword(body.currentPassword))) {
    return NextResponse.json({ error: "Current admin password is required." }, { status: 403 });
  }

  const bookings = await deleteAllBookingData();
  return NextResponse.json({ bookings });
}
