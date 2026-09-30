import { NextRequest, NextResponse } from "next/server";
import { refreshToken } from "@/lib/instagram";
import { logEvent } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Executado semanalmente pela Vercel. Mantém o token do Instagram válido. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await refreshToken();
    await logEvent("info", `Token do Instagram renovado. Validade até ${r.expiresAt.slice(0, 10)}.`);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logEvent("error", `Renovação do token falhou: ${e.message}`);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
