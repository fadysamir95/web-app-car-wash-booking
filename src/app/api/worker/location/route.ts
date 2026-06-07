import { NextResponse } from "next/server";
import { getAuthenticatedWorkerId, isWorkerAuthenticated } from "@/lib/admin";
import { updateWorkerLocation } from "@/lib/workers";

export async function POST(request: Request) {
  if (!(await isWorkerAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { latitude?: number; longitude?: number } | null;
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: "Invalid location." }, { status: 400 });
  }

  const workerId = await getAuthenticatedWorkerId();
  if (!workerId) return NextResponse.json({ error: "Worker not found." }, { status: 404 });

  const worker = await updateWorkerLocation(workerId, latitude, longitude);
  return NextResponse.json({ worker });
}
