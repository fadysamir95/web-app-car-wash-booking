import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin";
import { deletePromoCode } from "@/lib/store";

export async function DELETE(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { code } = await params;
  const promos = await deletePromoCode(code);
  if (!promos) {
    return NextResponse.json({ error: "Promo code not found." }, { status: 404 });
  }

  return NextResponse.json({ promos });
}
