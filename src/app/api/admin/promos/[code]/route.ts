import { NextResponse } from "next/server";
import { isAdminAuthenticated, verifyAdminCsrf } from "@/lib/admin";
import { deletePromoCode, updatePromoCode } from "@/lib/store";
import type { PromoCode } from "@/lib/types";

function promoPayload(body: Partial<PromoCode> | null, fallbackCode: string) {
  const discountType = body?.discountType === "percentage" ? "percentage" : "amount";
  const discountEgp = discountType === "amount" ? Number(body?.discountEgp || 0) : 0;
  const discountPercent = discountType === "percentage" ? Number(body?.discountPercent || 0) : undefined;
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : fallbackCode;

  if (discountEgp < 0 || (discountPercent !== undefined && (discountPercent <= 0 || discountPercent > 100))) {
    return null;
  }

  return {
    label,
    discountType,
    discountEgp,
    discountPercent,
    type: (discountType === "percentage" && discountPercent === 100) || discountEgp >= 25 ? "free_wash" : "fixed",
    active: body?.active !== false,
    maxUses: body?.maxUses ? Number(body.maxUses) : undefined,
    expiresAt: typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : undefined
  } satisfies Omit<PromoCode, "code">;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await verifyAdminCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const { code } = await params;
  const normalizedCode = code.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,32}$/.test(normalizedCode)) {
    return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Partial<PromoCode> | null;
  const payload = promoPayload(body, normalizedCode);
  if (!payload) {
    return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
  }

  const promos = await updatePromoCode(normalizedCode, payload);
  if (!promos) {
    return NextResponse.json({ error: "Promo code not found." }, { status: 404 });
  }

  return NextResponse.json({ promos });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await verifyAdminCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const { code } = await params;
  const promos = await deletePromoCode(code);
  if (!promos) {
    return NextResponse.json({ error: "Promo code not found." }, { status: 404 });
  }

  return NextResponse.json({ promos });
}
