import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/instagram";
import { setSetting, logEvent } from "@/lib/db";

export const runtime = "nodejs";

/** Valida o token junto ao Instagram antes de salvar. */
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));
  const t = String(token ?? "").trim();
  if (!t) return NextResponse.json({ error: "Cole o token de acesso." }, { status: 422 });
  try {
    const acc = await getAccount(t);
    await setSetting("ig_token", t);
    await setSetting("ig_user_id", acc.user_id);
    await setSetting("ig_username", acc.username);
    await setSetting("ig_token_expires_at", new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString());
    await logEvent("info", `Conta @${acc.username} conectada.`);
    return NextResponse.json({ ok: true, username: acc.username });
  } catch (e: any) {
    return NextResponse.json({ error: `O Instagram recusou o token: ${e.message}` }, { status: 422 });
  }
}
