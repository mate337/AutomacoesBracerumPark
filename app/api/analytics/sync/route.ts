import { NextResponse } from "next/server";
import { runSync } from "@/lib/analytics";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const full = new URL(req.url).searchParams.get("completo") === "1";
  try {
    return NextResponse.json({ ok: true, ...(await runSync({ full })) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 422 });
  }
}
