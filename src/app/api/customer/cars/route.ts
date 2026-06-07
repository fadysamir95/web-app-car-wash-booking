import { NextResponse } from "next/server";
import { hideCustomerCar, readHiddenCustomerCars } from "@/lib/customer-cars";
import { verifyOtpToken } from "@/lib/otp";
import { normalizePhone } from "@/lib/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phoneNumber = normalizePhone(searchParams.get("phoneNumber") || "");
  const otpToken = searchParams.get("otpToken") || "";

  if (!(await verifyOtpToken(phoneNumber, otpToken))) {
    return NextResponse.json({ error: "Phone verification is required." }, { status: 401 });
  }

  const hiddenCarKeys = await readHiddenCustomerCars(phoneNumber);
  return NextResponse.json({ hiddenCarKeys });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { phoneNumber?: string; otpToken?: string; carKey?: string } | null;
  const phoneNumber = normalizePhone(body?.phoneNumber || "");
  const otpToken = String(body?.otpToken || "");
  const carKey = String(body?.carKey || "").trim();

  if (!carKey) {
    return NextResponse.json({ error: "Car key is required." }, { status: 400 });
  }

  if (!(await verifyOtpToken(phoneNumber, otpToken))) {
    return NextResponse.json({ error: "Phone verification is required." }, { status: 401 });
  }

  const hiddenCarKeys = await hideCustomerCar(phoneNumber, carKey);
  return NextResponse.json({ hiddenCarKeys });
}
