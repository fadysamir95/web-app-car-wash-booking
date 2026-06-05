import { NextResponse } from "next/server";
import { getCapacity } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Missing date." }, { status: 400 });
  }

  return NextResponse.json(await getCapacity(date));
}
