import Link from "next/link";
import { getDashboard, formatOf, engagementRate, countryName, type MediaRow } from "@/lib/analytics";
import { getSetting } from "@/lib/db";
import { fmtDate, fmtInt } from "@/lib/format";
import { LineChart, ColumnChart, HBars } from "@/components/Charts";
import SyncButton from "@/components/SyncButton";

export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const GENDER: Record<string, string> = { F: "Feminino", M: "Masculino", U: "Não informado" };

function Delta({ cur, prev, show }: { cur: number; prev: number; show: boolean }) {
  if (!show || !prev) return null;
  const ch = cur / prev - 1;
  if (!isFinite(ch)) return null;
  const up = ch >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`} aria-label={`${up ? "alta" : "queda"} de ${Math.abs(Math.round(ch * 100))}%`}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(ch * 100))}%
    </span>
  );
}

const pct1 = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1).replace(".", ",")}%`);
const firstLine = (s: string | null) => (s ?? "").split("\n")[0].slice(0, 90) || "Sem legenda";

export default async function Monitoramento({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const period = PERIODS.includes(Number(sp.p)) ? Number(sp.p) : 30;
  const [d, username] = await Promise.all([getDashboard(period), getSetting("ig_username")]);
  const empty = !d.lastSync;

  const head = (
    <div className="page-head">
      <div>
        <p className="eyebrow">Monitoramento{username ? ` · @${username}` : ""}</p>
        <h1 className="display">Desempenho do <em>perfil</em>.</h1>
        {!empty && (
          <p className="small muted" style={{ marginTop: 14 }}>
            Atualizado em {fmtDate(d.lastSync)} · coleta automática diária. A Meta consolida os números em até 48 horas.
          </p>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
        {!empty && (
          <nav className="seg" aria-label="Período">
            {PERIODS.map((p) => (
              <Link key={p} href={`/monitoramento?p=${p}`} aria-current={p === period ? "page" : undefined} className={p === period ? "on" : ""}>
                {p} dias
              </Link>
            ))}
          </nav>
        )}
        {!empty && <SyncButton />}
      </div>
    </div>
  );

  if (empty) {
    return (
      <>
        {head}
        <div className="empty">
          <div>
            <h2 className="h2">Nenhuma coleta realizada ainda.</h2>
            <p className="muted" style={{ marginTop: 10, maxWidth: "60ch" }}>
              A primeira coleta recupera os últimos 30 dias de alcance, visualizações e interações, além do desempenho das 60 publicações
              mais recentes e da distribuição da audiência. A partir daí, a atualização é automática todas as manhãs.
            </p>
          </div>
          <SyncButton first />
        </div>
      </>
    );
  }

  const engagement = d.cur.reach ? d.cur.interactions / d.cur.reach : null;
  const prevEngagement = d.prev.reach ? d.prev.interactions / d.prev.reach : null;
  const followerDiff = d.followers !== null && d.followersFrom !== null ? d.followers - d.followersFrom : null;

  const ranked: (MediaRow & { er: number | null })[] = d.posts
    .map((p) => ({ ...p, er: engagementRate(p) }))
    .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
    .slice(0, 12);

  // Formatos e dias da semana: média de alcance, base de até 90 dias
  const groupAvg = (key: (p: MediaRow) => string) => {
    const m = new Map<string, number[]>();
    for (const p of d.basePosts) if (p.reach) m.set(key(p), [...(m.get(key(p)) ?? []), p.reach]);
    return [...m.entries()].map(([label, v]) => ({ label, value: v.reduce((a, b) => a + b, 0) / v.length, sub: `${v.length} publ.` }));
  };
  const formats = groupAvg(formatOf).sort((a, b) => b.value - a.value);
  const weekdays = groupAvg((p) => WEEKDAYS[new Date(new Date(p.posted_at).getTime() - 3 * 3600_000).getUTCDay()])
    .sort((a, b) => WEEKDAYS.indexOf(a.label) - WEEKDAYS.indexOf(b.label));

  const aud = (kind: string, map?: (k: string) => string, limit = 6) =>
    d.audience.filter((a) => a.kind === kind).slice(0, limit).map((a) => ({ label: map ? map(a.key) : a.key, value: a.value }));
  const ages = d.audience.filter((a) => a.kind === "age").sort((a, b) => a.key.localeCompare(b.key)).map((a) => ({ label: a.key, value: a.value }));

  return (
    <>
      {head}

      <section className="kpis" aria-label={`Últimos ${period} dias`}>
        <div className="kpi">
          <div className="kpi-value">{d.followers !== null ? fmtInt(d.followers) : "—"}</div>
          <div className="kpi-label">
            Seguidores
            {followerDiff !== null && followerDiff !== 0 && <span className={`delta ${followerDiff > 0 ? "up" : "down"}`}>{followerDiff > 0 ? "+" : ""}{fmtInt(followerDiff)}</span>}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{fmtInt(d.cur.reach)}</div>
          <div className="kpi-label">Contas alcançadas <Delta cur={d.cur.reach} prev={d.prev.reach} show={d.hasPrev} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{pct1(engagement)}</div>
          <div className="kpi-label">
            Engajamento sobre alcance
            {d.hasPrev && engagement !== null && prevEngagement ? <Delta cur={engagement} prev={prevEngagement} show /> : null}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{fmtInt(d.cur.taps)}</div>
          <div className="kpi-label">Toques nos links <Delta cur={d.cur.taps} prev={d.prev.taps} show={d.hasPrev} /></div>
        </div>
      </section>

      {d.insights.length > 0 && (
        <section style={{ marginBottom: 64 }}>
          <p className="eyebrow">Leituras do período</p>
          <div className="insights">
            {d.insights.map((i) => (
              <article key={i.title} className={`insight ${i.tone}`}>
                <h3>{i.title}</h3>
                <p>{i.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="grid-2" style={{ marginBottom: 64 }}>
        <section>
          <h2 className="h3">Seguidores</h2>
          <p className="small muted" style={{ margin: "6px 0 18px" }}>Registro diário a partir da primeira coleta.</p>
          <LineChart label="Seguidores por dia" data={d.followerSeries.map((r) => ({ label: r.day, value: r.followers }))} />
        </section>
        <section>
          <h2 className="h3">Alcance diário</h2>
          <p className="small muted" style={{ margin: "6px 0 18px" }}>
            {fmtInt(d.cur.views)} visualizações · {fmtInt(d.cur.interactions)} interações no período
          </p>
          <ColumnChart label="Contas alcançadas por dia" data={d.daily.map((r) => ({ label: r.day, value: r.reach }))} />
        </section>
      </div>

      <section style={{ marginBottom: 64 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <h2 className="h3">Publicações do período</h2>
          <span className="small muted">Ordenadas por alcance · {d.posts.length} publicação(ões)</span>
        </div>
        {ranked.length === 0 ? (
          <p className="muted small">Nenhuma publicação nos últimos {period} dias.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Publicação</th><th>Formato</th><th className="r">Alcance</th><th className="r">Interações</th>
                  <th className="r">Salv.</th><th className="r">Compart.</th><th className="r">Engaj.</th><th className="r">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a className="post-cell" href={p.permalink} target="_blank" rel="noreferrer">
                        {p.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.thumbnail_url} alt="" loading="lazy" />
                        ) : <span className="thumb-empty" />}
                        <span>
                          {firstLine(p.caption)}
                          <span className="sub">{fmtDate(p.posted_at)}</span>
                        </span>
                      </a>
                    </td>
                    <td>{formatOf(p)}</td>
                    <td className="r">{p.reach !== null ? fmtInt(p.reach) : "—"}</td>
                    <td className="r">{fmtInt(p.total_interactions ?? (p.likes ?? 0) + (p.comments ?? 0))}</td>
                    <td className="r">{p.saves !== null ? fmtInt(p.saves) : "—"}</td>
                    <td className="r">{p.shares !== null ? fmtInt(p.shares) : "—"}</td>
                    <td className="r">{pct1(p.er)}</td>
                    <td className="r">{p.leads ? <strong>{fmtInt(p.leads)}</strong> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2" style={{ marginBottom: 64 }}>
        <section>
          <h2 className="h3">Alcance médio por formato</h2>
          <p className="small muted" style={{ margin: "6px 0 18px" }}>Base: publicações dos últimos {Math.max(period, 90)} dias.</p>
          <HBars rows={formats} format="int" />
        </section>
        <section>
          <h2 className="h3">Alcance médio por dia de publicação</h2>
          <p className="small muted" style={{ margin: "6px 0 18px" }}>Horário de Brasília. Mesma base.</p>
          <HBars rows={weekdays} format="int" />
        </section>
      </div>

      <section>
        <p className="eyebrow">Audiência</p>
        {d.audience.length === 0 ? (
          <p className="muted small">A Meta libera os dados demográficos a partir de 100 seguidores.</p>
        ) : (
          <div className="grid-4">
            <div><h2 className="h3" style={{ marginBottom: 16 }}>Países</h2><HBars rows={aud("country", countryName)} /></div>
            <div><h2 className="h3" style={{ marginBottom: 16 }}>Cidades</h2><HBars rows={aud("city", (c) => c.split(",")[0])} /></div>
            <div><h2 className="h3" style={{ marginBottom: 16 }}>Faixa etária</h2><HBars rows={ages} /></div>
            <div><h2 className="h3" style={{ marginBottom: 16 }}>Gênero</h2><HBars rows={aud("gender", (g) => GENDER[g] ?? g)} /></div>
          </div>
        )}
      </section>
    </>
  );
}
