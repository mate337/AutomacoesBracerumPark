import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { validate, uniqueSlug } from "@/lib/automations";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const { errors, data } = await validate(payload);
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });

  const slug = await uniqueSlug(data.keywords[0] || data.name);
  const rows = await q<{ id: string }>`
    insert into automations (name, slug, keywords, match_mode, post_ids, delivery_mode, public_reply, default_lang,
                             content, pdf_url, pdf_name, pdf_size, active)
    values (${data.name}, ${slug}, ${data.keywords}, ${data.match_mode}, ${data.post_ids}, ${data.delivery_mode},
            ${data.public_reply}, ${data.default_lang}, ${JSON.stringify(data.content)}::jsonb,
            ${data.pdf_url}, ${data.pdf_name}, ${data.pdf_size}, ${data.active})
    returning id`;
  return NextResponse.json({ id: rows[0].id });
}
