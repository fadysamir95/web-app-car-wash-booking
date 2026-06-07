import { NextResponse } from "next/server";
import { changeAdminPassword, isAdminAuthenticated, verifyAdminCsrf } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await verifyAdminCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(`admin-password:${ip}`, 5, 15 * 60 * 1000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { currentPassword?: string; newPassword?: string } | null;
  const result = await changeAdminPassword(body?.currentPassword || "", body?.newPassword || "");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
