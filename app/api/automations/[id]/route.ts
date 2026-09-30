import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { q } from "@/lib/db";
import { validate, getAutomation } from "@/lib/automations";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const current = await getAutomation(id);
  if (!current) return NextResponse.json({ errors: ["Automação não encontrada."] }, { status: 404 });

  const { errors, data } = await validate(await req.json().catch(() => ({})), id);
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });

  await q`update automations set name = ${data.name}, keywords = ${data.keywords}, match_mode = ${data.match_mode},
    post_ids = ${data.post_ids}, delivery_mode = ${data.delivery_mode}, public_reply = ${data.public_reply},
    default_lang = ${data.default_lang}, content = ${JSON.stringify(data.content)}::jsonb, pdf_url = ${data.pdf_url},
    pdf_name = ${data.pdf_name}, pdf_size = ${data.pdf_size}, active = ${data.active}, updated_at = now()
    where id = ${id}`;

  if (current.pdf_url && current.pdf_url !== data.pdf_url) await del(current.pdf_url).catch(() => {});
  return NextResponse.json({ id });
}

/** Ativar ou pausar. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const current = await getAutomation(id);
  if (!current) return NextResponse.json({ errors: ["Automação não encontrada."] }, { status: 404 });
  const { active } = await req.json().catch(() => ({}));

  if (active) {
    const { errors } = await validate({ ...current, active: true }, id);
    if (errors.length) return NextResponse.json({ errors }, { status: 422 });
  }
  await q`update automations set active = ${!!active}, updated_at = now() where id = ${id}`;
  return NextResponse.json({ id, active: !!active });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const current = await getAutomation(id);
  if (!current) return NextResponse.json({ ok: true });
  await q`delete from automations where id = ${id}`;
  if (current.pdf_url) await del(current.pdf_url).catch(() => {});
  return NextResponse.json({ ok: true });
}
