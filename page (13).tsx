import Link from "next/link";
import { q, getSetting } from "@/lib/db";
import { fmtInt, fmtPct } from "@/lib/format";
import ActiveToggle from "@/components/ActiveToggle";
import type { Automation } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = Automation & { captured: number; delivered: number };

export default async function Automacoes() {
  const [rows, totals, token] = await Promise.all([
    q<Row>`select a.*,
             count(d.id)::int as captured,
             count(d.id) filter (where d.status = 'delivered')::int as delivered
           from automations a left join deliveries d on d.automation_id = a.id
           group by a.id order by a.active desc, a.created_at desc`,
    q<{ captured: number; delivered: number; contacts: number; clicks: number }>`
      select
        (select count(*) from deliveries where created_at > now() - interval '30 days')::int as captured,
        (select count(*) from deliveries where status = 'delivered' and created_at > now() - interval '30 days')::int as delivered,
        (select count(*) from contacts where first_seen > now() - interval '30 days')::int as contacts,
        (select coalesce(sum(link_clicks), 0) from deliveries where created_at > now() - interval '30 days')::int as clicks`,
    getSetting("ig_token"),
  ]);
  const t = totals[0];
  const connected = !!(token || process.env.IG_ACCESS_TOKEN);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Automações de comentário</p>
          <h1 className="display">Comentou, <em>recebeu</em>.</h1>
          <p className="lede">
            Quem comenta a palavra-chave recebe o material no Direct, no idioma em que escreveu. A partir da resposta,
            a conversa segue com o time comercial.
          </p>
        </div>
        <Link href="/automacoes/nova" className="btn">Nova automação</Link>
      </div>

      {!connected && (
        <div className="notice">
          <span>A conta do Instagram ainda não está conectada. As automações só funcionam após a conexão.</span>
          <Link href="/configuracoes" className="btn btn-sm">Conectar</Link>
        </div>
      )}

      <section className="kpis" aria-label="Últimos 30 dias">
        <div className="kpi"><div className="kpi-value">{fmtInt(t.captured)}</div><div className="kpi-label">Comentários captados · 30 dias</div></div>
        <div className="kpi"><div className="kpi-value">{fmtInt(t.delivered)}</div><div className="kpi-label">Materiais entregues</div></div>
        <div className="kpi"><div className="kpi-value">{fmtPct(t.delivered, t.captured)}</div><div className="kpi-label">Taxa de entrega</div></div>
        <div className="kpi"><div className="kpi-value">{fmtInt(t.contacts)}</div><div className="kpi-label">Novos contatos</div></div>
      </section>

      {rows.length === 0 ? (
        <div className="empty">
          <div>
            <h2 className="h2">Nenhuma automação criada.</h2>
            <p className="muted" style={{ marginTop: 10 }}>Comece por um dos cinco guias aprovados ou por uma automação em branco.</p>
          </div>
          <Link href="/automacoes/nova" className="btn">Criar a primeira</Link>
        </div>
      ) : (
        <div className="list">
          <div className="row row-head">
            <span>Automação</span><span>Palavras-chave</span><span>Captados</span><span>Entregues</span><span>Situação</span>
          </div>
          {rows.map((a) => (
            <div className="row" key={a.id}>
              <div>
                <div className="row-title"><Link href={`/automacoes/${a.id}`}>{a.name}</Link></div>
                <div className="row-meta">
                  {a.delivery_mode === "button" ? "PDF no Direct após o toque" : "Link direto na primeira mensagem"}
                  {" · "}
                  {a.post_ids.length ? `${a.post_ids.length} publicação(ões)` : "Todas as publicações"}
                  {!a.pdf_url && <> · <span style={{ color: "var(--err)" }}>sem PDF</span></>}
                </div>
              </div>
              <div className="chips hide-sm">{a.keywords.map((k) => <span className="chip" key={k}>{k}</span>)}</div>
              <div className="num hide-sm">{fmtInt(a.captured)}</div>
              <div className="num hide-sm">{fmtInt(a.delivered)}<small>{fmtPct(a.delivered, a.captured)}</small></div>
              <div><ActiveToggle id={a.id} active={a.active} /></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
