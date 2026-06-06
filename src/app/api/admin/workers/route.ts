import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin";
import { createWorker, publicWorker, readWorkers } from "@/lib/workers";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const workers = await readWorkers();
  return NextResponse.json({ workers: workers.map(publicWorker) });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string; password?: string; areas?: string[] } | null;
  if (!body?.name || !body.password || body.password.length < 6) {
    return NextResponse.json({ error: "Worker name and password are required." }, { status: 400 });
  }

  const worker = await createWorker({ name: body.name, password: body.password, areas: Array.isArray(body.areas) ? body.areas : [] });
  return NextResponse.json({ worker }, { status: 201 });
}
