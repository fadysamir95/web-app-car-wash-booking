import { NextResponse } from "next/server";
import { isAdminAuthenticated, verifyAdminCsrf } from "@/lib/admin";
import { readSettings, writeSettings } from "@/lib/store";
import type { ServiceSettings } from "@/lib/types";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ settings: await readSettings() });
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await verifyAdminCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ServiceSettings | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  }

  const settings = await writeSettings(body);
  return NextResponse.json({ settings });
}
