import Link from "next/link";
import { q } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { STATUS_LABEL, type DeliveryStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const BADGE: Record<DeliveryStatus, string> = {
  received: "badge-neutral", awaiting: "badge-warn", delivering: "badge-warn", delivered: "badge-ok", duplicate: "badge-neutral", failed: "badge-err",
};
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Todos" },
  { key: "delivered", label: "Entregues" },
  { key: "awaiting", label: "Aguardando toque" },
  { key: "failed", label: "Falhas" },
];

type Row = {
  id: string; username: string | null; comment_text: string | null; lang: string; status: DeliveryStatus; error: string | null;
  created_at: string; delivered_at: string | null; link_clicks: number; automation: string | null; full_name: string | null;
};

export default async function Atividade({ searchParams }: { searchParams: Promise<{ status?: string; automacao?: string }> }) {
  const sp = await searchParams;
  const status = FILTERS.some((f) => f.key === sp.status) ? sp.status ?? "" : "";
  const auto = sp.automacao && /^[0-9a-f-]{36}$/i.test(sp.automacao) ? sp.automacao : null;

  const [rows, log] = await Promise.all([
    q<Row>`select d.id, d.username, d.comment_text, d.lang, d.status, d.error, d.created_at, d.delivered_at, d.link_clicks,
             a.name as automation, c.full_name
           from deliveries d
           left join automations a on a.id = d.automation_id
           left join contacts c on c.ig_user_id = d.ig_user_id
           where (${status} = '' or d.status = ${status}) and (${auto}::uuid is null or d.automation_id = ${auto}::uuid)
           order by d.created_at desc limit 300`,
    q<{ level: string; message: string; created_at: string }>`
      select level, message, created_at from event_log where level <> 'info' or created_at > now() - interval '7 days'
      order by created_at desc limit 30`,
  ]);

  const qs = (k: string) => {
    const p = new URLSearchParams();
    if (k) p.set("status", k);
    if (auto) p.set("automacao", auto);
    const s = p.toString();
    return s ? `/atividade?${s}` : "/atividade";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Atividade</p>
          <h1 className="display">Quem pediu, <em>quem recebeu</em>.</h1>
          <p className="lede">Os 300 registros mais recentes. Quem responde depois da entrega aparece no Direct para o time comercial.</p>
        </div>
      </div>

      <div className="filters">
        {FILTERS.map((f) => <Link key={f.key} href={qs(f.key)} className={status === f.key ? "is-active" : ""}>{f.label}</Link>)}
        {auto && <Link href={status ? `/atividade?status=${status}` : "/atividade"}>× Todas as automações</Link>}
      </div>

      {rows.length === 0 ? (
        <div className="empty"><p className="muted" style={{ margin: 0 }}>Nenhum registro para este filtro.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Quando</th><th>Pessoa</th><th>Comentário</th><th>Automação</th><th>Idioma</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                  <td>
                    {r.username ? <a href={`https://instagram.com/${r.username}`} target="_blank" rel="noreferrer">@{r.username}</a> : "—"}
                    {r.full_name && <div className="sub">{r.full_name}</div>}
                  </td>
                  <td style={{ maxWidth: 280 }}>{r.comment_text}</td>
                  <td>{r.automation ?? <span className="muted">removida</span>}</td>
                  <td>{r.lang === "es" ? "ES" : "PT"}</td>
                  <td>
                    <span className={`badge ${BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {r.link_clicks > 0 && <div className="sub">{r.link_clicks} abertura(s) do link</div>}
                    {r.error && <div className="sub" style={{ color: "var(--err)", maxWidth: 260 }}>{r.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 72 }}>
        <p className="eyebrow">Registro técnico</p>
        {log.length === 0 ? <p className="muted small">Sem ocorrências.</p> : (
          <div className="table-wrap">
            <table>
              <tbody>
                {log.map((l, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap", width: 150 }}>{fmtDate(l.created_at)}</td>
                    <td style={{ width: 90 }}>
                      <span className={`badge ${l.level === "error" ? "badge-err" : l.level === "warn" ? "badge-warn" : "badge-neutral"}`}>
                        {l.level === "error" ? "Erro" : l.level === "warn" ? "Aviso" : "Info"}
                      </span>
                    </td>
                    <td>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
