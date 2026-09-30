import { NextResponse } from "next/server";
import { listMedia } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ media: await listMedia(36) });
  } catch (e: any) {
    return NextResponse.json({ media: [], error: e.message }, { status: 200 });
  }
}
