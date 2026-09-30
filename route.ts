import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Link curto do material: registra o clique e redireciona para o PDF. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = await q<{ pdf_url: string | null }>`select pdf_url from automations where slug = ${slug}`;
  const url = rows[0]?.pdf_url;
  if (!url) return new NextResponse("Material indisponível.", { status: 404 });

  const d = req.nextUrl.searchParams.get("d");
  if (d && /^[0-9a-f-]{36}$/i.test(d)) {
    await q`update deliveries set link_clicks = link_clicks + 1 where id = ${d}`.catch(() => {});
  }
  return NextResponse.redirect(url, 302);
}
