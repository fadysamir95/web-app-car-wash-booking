import { NextResponse } from "next/server";
import { getAuthenticatedWorkerId, isWorkerAuthenticated } from "@/lib/admin";
import { completeBookingWithProof } from "@/lib/store";
import { getWorkerById, recordWorkerWash } from "@/lib/workers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!(await isWorkerAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { imageName?: string; imageDataUrl?: string } | null;
  if (!body?.imageName || !body.imageDataUrl?.startsWith("data:image/")) {
    return NextResponse.json({ error: "Wash proof image is required." }, { status: 400 });
  }
  if (body.imageDataUrl.length > 1_800_000) {
    return NextResponse.json({ error: "Image is too large." }, { status: 400 });
  }

  const { id } = await context.params;
  const workerId = await getAuthenticatedWorkerId();
  const worker = workerId ? await getWorkerById(workerId) : null;
  const booking = await completeBookingWithProof(id, {
    imageName: body.imageName.slice(0, 120),
    imageDataUrl: body.imageDataUrl,
    workerId: workerId || undefined,
    workerName: worker?.name
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (workerId) await recordWorkerWash(workerId);
  return NextResponse.json({ booking });
}
