import Link from "next/link";
import { notFound } from "next/navigation";
import AutomationForm from "@/components/AutomationForm";
import { getAutomation } from "@/lib/automations";
import { q } from "@/lib/db";
import { fmtInt, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAutomation(id);
  if (!a) notFound();

  const [st] = await q<{ captured: number; delivered: number; awaiting: number; clicks: number }>`
    select count(*)::int as captured,
           count(*) filter (where status = 'delivered')::int as delivered,
           count(*) filter (where status = 'awaiting')::int as awaiting,
           coalesce(sum(link_clicks), 0)::int as clicks
    from deliveries where automation_id = ${id}`;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow"><Link href="/">Automações</Link> / {a.active ? "Ativa" : "Pausada"}</p>
          <h1 className="display">{a.name}</h1>
        </div>
        <Link className="btn btn-ghost" href={`/atividade?automacao=${a.id}`}>Ver atividade</Link>
      </div>
      <section className="kpis">
        <div className="kpi"><div className="kpi-value">{fmtInt(st.captured)}</div><div className="kpi-label">Comentários captados</div></div>
        <div className="kpi"><div className="kpi-value">{fmtInt(st.delivered)}</div><div className="kpi-label">Entregues · {fmtPct(st.delivered, st.captured)}</div></div>
        <div className="kpi"><div className="kpi-value">{fmtInt(st.awaiting)}</div><div className="kpi-label">Aguardando o toque</div></div>
        <div className="kpi"><div className="kpi-value">{fmtInt(st.clicks)}</div><div className="kpi-label">Aberturas pelo link</div></div>
      </section>
      <AutomationForm
        id={a.id}
        slug={a.slug}
        initial={{
          name: a.name, keywords: a.keywords, match_mode: a.match_mode, post_ids: a.post_ids, delivery_mode: a.delivery_mode,
          public_reply: a.public_reply, default_lang: a.default_lang, content: a.content, pdf_url: a.pdf_url, pdf_name: a.pdf_name,
          pdf_size: a.pdf_size, active: a.active,
        }}
      />
    </>
  );
}
