import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin";
import { deleteCustomerData, updateCustomerData } from "@/lib/store";
import { normalizePhone } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ phone: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { phone } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const updates = {
    customerName: stringValue(body?.customerName),
    phoneNumber: body?.phoneNumber ? normalizePhone(stringValue(body.phoneNumber)) : undefined,
    carBrand: stringValue(body?.carBrand),
    carModel: stringValue(body?.carModel),
    carColor: stringValue(body?.carColor),
    plateNumber: body?.plateNumber === undefined ? undefined : stringValue(body.plateNumber).toUpperCase()
  };

  if (!updates.customerName || !updates.phoneNumber || !updates.carBrand || !updates.carModel || !updates.carColor) {
    return NextResponse.json({ error: "Missing required customer fields." }, { status: 400 });
  }

  const bookings = await updateCustomerData(decodeURIComponent(phone), updates);
  if (!bookings) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  return NextResponse.json({ bookings });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { phone } = await context.params;
  const bookings = await deleteCustomerData(decodeURIComponent(phone));
  if (!bookings) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  return NextResponse.json({ bookings });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
