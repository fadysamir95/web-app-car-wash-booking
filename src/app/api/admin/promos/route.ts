import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin";
import { createPromoCode, readPromoCodes } from "@/lib/store";
import type { PromoCode } from "@/lib/types";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ promos: await readPromoCodes() });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Partial<PromoCode> | null;
  const code = typeof body?.code === "string" ? body.code.trim().toLowerCase() : "";
  const discountEgp = Number(body?.discountEgp || 0);
  const label = typeof body?.label === "string" ? body.label.trim() : code;

  if (!/^[a-z0-9-]{3,32}$/.test(code) || discountEgp < 0) {
    return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
  }

  const promos = await createPromoCode({
    code,
    label,
    discountEgp,
    type: discountEgp >= 25 ? "free_wash" : "fixed",
    active: body?.active !== false,
    maxUses: body?.maxUses ? Number(body.maxUses) : undefined,
    expiresAt: typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : undefined
  });

  if (!promos) {
    return NextResponse.json({ error: "Promo code already exists." }, { status: 409 });
  }

  return NextResponse.json({ promos });
}
