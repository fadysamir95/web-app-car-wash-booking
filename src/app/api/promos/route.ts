import { NextResponse } from "next/server";
import { activePromoCodes, readPromoCodes } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ promos: activePromoCodes(await readPromoCodes()) });
}
