import { NextResponse } from "next/server";
import { isAdminAuthenticated, verifyAdminCsrf } from "@/lib/admin";
import { deleteWorker, updateWorker } from "@/lib/workers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await verifyAdminCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { name?: string; password?: string; areas?: string[] } | null;
  const worker = await updateWorker(id, {
    name: body?.name,
    password: body?.password,
    areas: Array.isArray(body?.areas) ? body?.areas : undefined
  });

  if (!worker) return NextResponse.json({ error: "Worker not found." }, { status: 404 });
  return NextResponse.json({ worker });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await verifyAdminCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const { id } = await context.params;
  const workers = await deleteWorker(id);
  if (!workers) return NextResponse.json({ error: "Worker not found." }, { status: 404 });
  return NextResponse.json({ workers });
}
