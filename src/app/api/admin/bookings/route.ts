import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin";
import { readBookings } from "@/lib/store";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const bookings = await readBookings();
  return NextResponse.json({ bookings });
}
