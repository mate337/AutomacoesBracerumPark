import { NextResponse } from "next/server";
import { refreshToken } from "@/lib/instagram";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, ...(await refreshToken()) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }
}
