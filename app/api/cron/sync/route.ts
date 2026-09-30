import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/analytics";
import { logEvent } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Coleta diária das métricas do Instagram, executada pela Vercel. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await runSync();
    await logEvent("info", `Monitoramento atualizado: ${r.days} dia(s), ${r.media} publicação(ões).`);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logEvent("error", `Coleta do monitoramento falhou: ${e.message}`);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
