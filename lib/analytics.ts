import { q, getSetting, setSetting, logEvent } from "./db";
import { getAccount, accountTotals, followerDemographics, listMediaFull, mediaInsights } from "./instagram";

// Dias no fuso de São Paulo (UTC-3, sem horário de verão).
const TZ_OFFSET_H = 3;

export function isoDay(d: Date): string {
  return new Date(d.getTime() - TZ_OFFSET_H * 3600_000).toISOString().slice(0, 10);
}
function dayBounds(day: string): [number, number] {
  const start = Date.parse(`${day}T0${TZ_OFFSET_H}:00:00Z`) / 1000;
  return [start, start + 86400];
}
function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

const DAILY_METRICS = ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves", "profile_links_taps"];

async function dailyValues(igId: string, day: string): Promise<Record<string, number | null>> {
  const [since, until] = dayBounds(day);
  const out: Record<string, number | null> = {};
  const read = (rows: Awaited<ReturnType<typeof accountTotals>>) => {
    for (const r of rows) out[r.name] = r.total_value?.value ?? 0;
  };
  try {
    read(await accountTotals(igId, DAILY_METRICS, since, until));
  } catch {
    // Alguma métrica recusada: busca uma a uma, sem interromper as demais.
    for (const m of DAILY_METRICS) {
      try { read(await accountTotals(igId, [m], since, until)); } catch { out[m] = null; }
    }
  }
  try {
    const [row] = await accountTotals(igId, ["follows_and_unfollows"], since, until, "follow_type");
    const results = row?.total_value?.breakdowns?.[0]?.results ?? [];
    out.follows = results.find((r) => r.dimension_values[0] === "FOLLOWER")?.value ?? 0;
    out.unfollows = results.find((r) => r.dimension_values[0] === "NON_FOLLOWER")?.value ?? 0;
  } catch {
    out.follows = null;
    out.unfollows = null;
  }
  return out;
}

export type SyncResult = { days: number; media: number; audience: number; followers: number | null; errors: string[] };

/** Coleta e grava as métricas. Na primeira execução recupera 30 dias; depois, os 3 últimos (a Meta consolida em até 48 h). */
export async function runSync(opts: { full?: boolean } = {}): Promise<SyncResult> {
  const errors: string[] = [];
  const account = await getAccount();
  const igId = account.user_id || (await getSetting("ig_user_id")) || "";
  const today = isoDay(new Date());

  await q`insert into account_daily (day, followers) values (${today}, ${account.followers_count ?? null})
          on conflict (day) do update set followers = excluded.followers, updated_at = now()`;

  const [{ n }] = await q<{ n: number }>`select count(*)::int as n from account_daily where reach is not null`;
  const span = opts.full || n < 20 ? 30 : 3;
  const days = Array.from({ length: span }, (_, i) => addDays(today, -(i + 1)));

  await pool(days, 4, async (day) => {
    try {
      const v = await dailyValues(igId, day);
      await q`insert into account_daily (day, reach, views, accounts_engaged, total_interactions, likes, comments, shares, saves,
                                         profile_links_taps, follows, unfollows)
              values (${day}, ${v.reach}, ${v.views}, ${v.accounts_engaged}, ${v.total_interactions}, ${v.likes}, ${v.comments},
                      ${v.shares}, ${v.saves}, ${v.profile_links_taps}, ${v.follows}, ${v.unfollows})
              on conflict (day) do update set reach = excluded.reach, views = excluded.views, accounts_engaged = excluded.accounts_engaged,
                total_interactions = excluded.total_interactions, likes = excluded.likes, comments = excluded.comments,
                shares = excluded.shares, saves = excluded.saves, profile_links_taps = excluded.profile_links_taps,
                follows = excluded.follows, unfollows = excluded.unfollows, updated_at = now()`;
    } catch (e: any) {
      errors.push(`${day}: ${e.message}`);
    }
  });

  let mediaCount = 0;
  try {
    const media = await listMediaFull(60);
    await pool(media, 5, async (m) => {
      const ins = await mediaInsights(m.id, m.media_product_type);
      const likes = ins.likes ?? m.like_count ?? null;
      const comments = ins.comments ?? m.comments_count ?? null;
      await q`insert into media_items (id, media_type, media_product_type, caption, permalink, thumbnail_url, posted_at, reach, views,
                                       likes, comments, shares, saves, total_interactions, avg_watch_ms)
              values (${m.id}, ${m.media_type}, ${m.media_product_type ?? null}, ${m.caption ?? null}, ${m.permalink},
                      ${m.thumbnail_url || m.media_url || null}, ${m.timestamp}, ${ins.reach ?? null}, ${ins.views ?? null},
                      ${likes}, ${comments}, ${ins.shares ?? null}, ${ins.saved ?? null}, ${ins.total_interactions ?? null},
                      ${ins.ig_reels_avg_watch_time ?? null})
              on conflict (id) do update set caption = excluded.caption, thumbnail_url = excluded.thumbnail_url,
                reach = coalesce(excluded.reach, media_items.reach), views = coalesce(excluded.views, media_items.views),
                likes = excluded.likes, comments = excluded.comments, shares = coalesce(excluded.shares, media_items.shares),
                saves = coalesce(excluded.saves, media_items.saves),
                total_interactions = coalesce(excluded.total_interactions, media_items.total_interactions),
                avg_watch_ms = coalesce(excluded.avg_watch_ms, media_items.avg_watch_ms), updated_at = now()`;
      mediaCount++;
    });
  } catch (e: any) {
    errors.push(`publicações: ${e.message}`);
  }

  let audienceCount = 0;
  for (const kind of ["country", "city", "age", "gender"] as const) {
    const rows = await followerDemographics(igId, kind);
    if (!rows.length) continue;
    await q`delete from audience where kind = ${kind}`;
    for (const r of rows) await q`insert into audience (kind, key, value) values (${kind}, ${r.key}, ${r.value})`;
    audienceCount += rows.length;
  }

  await setSetting("analytics_last_sync", new Date().toISOString());
  if (errors.length) await logEvent("warn", `Monitoramento: ${errors.length} falha(s) na coleta.`, errors.slice(0, 10));
  return { days: span, media: mediaCount, audience: audienceCount, followers: account.followers_count ?? null, errors };
}

// ─── Leitura para o painel ─────────────────────────────────────────────

export type Daily = {
  day: string; followers: number | null; reach: number | null; views: number | null; accounts_engaged: number | null;
  total_interactions: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null;
  profile_links_taps: number | null; follows: number | null; unfollows: number | null;
};
export type MediaRow = {
  id: string; media_type: string; media_product_type: string | null; caption: string | null; permalink: string; thumbnail_url: string | null;
  posted_at: string; reach: number | null; views: number | null; likes: number | null; comments: number | null; shares: number | null;
  saves: number | null; total_interactions: number | null; avg_watch_ms: number | null; leads: number;
};

type Totals = { reach: number; views: number; interactions: number; saves: number; shares: number; taps: number; follows: number; unfollows: number; engaged: number };

function sum(rows: Daily[], k: keyof Daily) {
  return rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
}
function totals(rows: Daily[]): Totals {
  return {
    reach: sum(rows, "reach"), views: sum(rows, "views"), interactions: sum(rows, "total_interactions"), saves: sum(rows, "saves"),
    shares: sum(rows, "shares"), taps: sum(rows, "profile_links_taps"), follows: sum(rows, "follows"), unfollows: sum(rows, "unfollows"),
    engaged: sum(rows, "accounts_engaged"),
  };
}

export function formatOf(m: Pick<MediaRow, "media_type" | "media_product_type">): string {
  if (m.media_product_type === "REELS") return "Reels";
  if (m.media_type === "CAROUSEL_ALBUM") return "Carrossel";
  if (m.media_type === "VIDEO") return "Vídeo";
  return "Imagem";
}

export function engagementRate(m: Pick<MediaRow, "reach" | "total_interactions" | "likes" | "comments" | "saves" | "shares">): number | null {
  const inter = m.total_interactions ?? (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0);
  return m.reach ? inter / m.reach : null;
}

export async function getDashboard(period: number) {
  const today = isoDay(new Date());
  const start = addDays(today, -period);
  const prevStart = addDays(today, -2 * period);

  const [daily, prevDaily, followersNow, followersStart, posts, basePosts, audience, lastSync, followerSeries] = await Promise.all([
    q<Daily>`select to_char(day, 'YYYY-MM-DD') as day, followers, reach, views, accounts_engaged, total_interactions, likes, comments,
               shares, saves, profile_links_taps, follows, unfollows
             from account_daily where day >= ${start} and day < ${today} order by day`,
    q<Daily>`select * from account_daily where day >= ${prevStart} and day < ${start}`,
    q<{ followers: number }>`select followers from account_daily where followers is not null order by day desc limit 1`,
    q<{ followers: number; day: string }>`select followers, to_char(day, 'YYYY-MM-DD') as day from account_daily
             where followers is not null and day >= ${start} order by day asc limit 1`,
    q<MediaRow>`select m.*, coalesce(l.leads, 0)::int as leads from media_items m
             left join (select media_id, count(*) as leads from deliveries group by media_id) l on l.media_id = m.id
             where m.posted_at >= ${start}::date order by m.posted_at desc`,
    q<MediaRow>`select m.*, coalesce(l.leads, 0)::int as leads from media_items m
             left join (select media_id, count(*) as leads from deliveries group by media_id) l on l.media_id = m.id
             where m.posted_at >= ${addDays(today, -Math.max(period, 90))}::date order by m.posted_at desc`,
    q<{ kind: string; key: string; value: number }>`select kind, key, value from audience order by value desc`,
    getSetting("analytics_last_sync"),
    q<{ day: string; followers: number }>`select to_char(day, 'YYYY-MM-DD') as day, followers from account_daily
             where followers is not null and day >= ${start} order by day`,
  ]);

  const cur = totals(daily);
  const prev = totals(prevDaily);
  const followers = followersNow[0]?.followers ?? null;
  const followersFrom = followersStart[0]?.followers ?? null;

  return {
    period, start, today, daily, followerSeries, cur, prev, followers, followersFrom, followersFromDay: followersStart[0]?.day ?? null,
    hasPrev: prevDaily.some((d) => d.reach !== null), posts, basePosts, audience, lastSync,
    insights: buildInsights({ period, cur, prev, hasPrev: prevDaily.some((d) => d.reach !== null), followers, followersFrom, posts, basePosts, audience }),
  };
}

// ─── Leituras automáticas ──────────────────────────────────────────────

export type Insight = { tone: "positive" | "neutral" | "attention"; title: string; text: string };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n = (x: number) => new Intl.NumberFormat("pt-BR").format(Math.round(x));
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const COUNTRY: Record<string, string> = { BR: "Brasil", PY: "Paraguai", AR: "Argentina", US: "Estados Unidos", UY: "Uruguai", BO: "Bolívia", CL: "Chile", PT: "Portugal", ES: "Espanha" };
export const countryName = (c: string) => COUNTRY[c] ?? c;

function avg(list: number[]) {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
}

/**
 * Observações objetivas, calculadas a partir dos dados. Nenhuma leitura é gerada sem base mínima
 * (quantidade de publicações ou de dias), para não induzir decisões com amostra insuficiente.
 */
export function buildInsights(d: {
  period: number; cur: Totals; prev: Totals; hasPrev: boolean; followers: number | null; followersFrom: number | null;
  posts: MediaRow[]; basePosts: MediaRow[]; audience: { kind: string; key: string; value: number }[];
}): Insight[] {
  const out: Insight[] = [];

  // Alcance em relação ao período anterior
  if (d.hasPrev && d.prev.reach > 0 && d.cur.reach > 0) {
    const ch = d.cur.reach / d.prev.reach - 1;
    if (Math.abs(ch) >= 0.1) {
      out.push({
        tone: ch > 0 ? "positive" : "attention",
        title: ch > 0 ? `Alcance ${pct(ch)} acima do período anterior` : `Alcance ${pct(-ch)} abaixo do período anterior`,
        text: `${n(d.cur.reach)} contas alcançadas nos últimos ${d.period} dias, contra ${n(d.prev.reach)} nos ${d.period} dias anteriores.`,
      });
    }
  }

  // Crescimento de seguidores
  if (d.followers !== null && d.followersFrom !== null && d.followers !== d.followersFrom) {
    const diff = d.followers - d.followersFrom;
    out.push({
      tone: diff > 0 ? "positive" : "attention",
      title: diff > 0 ? `+${n(diff)} seguidores no período` : `${n(diff)} seguidores no período`,
      text: `A base passou de ${n(d.followersFrom)} para ${n(d.followers)} (${diff > 0 ? "+" : ""}${pct(diff / Math.max(1, d.followersFrom))}).`,
    });
  }

  // Formatos
  const byFormat = new Map<string, number[]>();
  for (const p of d.basePosts) {
    if (!p.reach) continue;
    const f = formatOf(p);
    byFormat.set(f, [...(byFormat.get(f) ?? []), p.reach]);
  }
  const formats = [...byFormat.entries()].filter(([, v]) => v.length >= 3).map(([f, v]) => ({ f, avg: avg(v), count: v.length })).sort((a, b) => b.avg - a.avg);
  if (formats.length >= 2 && formats[0].avg >= formats[formats.length - 1].avg * 1.3) {
    const best = formats[0];
    const worst = formats[formats.length - 1];
    out.push({
      tone: "neutral",
      title: `${best.f} alcança ${(best.avg / worst.avg).toFixed(1).replace(".", ",")}× mais que ${worst.f.toLowerCase()}`,
      text: `Média de ${n(best.avg)} contas por ${best.f.toLowerCase()} (${best.count} publicações) contra ${n(worst.avg)} por ${worst.f.toLowerCase()} (${worst.count}).`,
    });
  }

  // Conteúdo de referência (salvamentos) e de indicação (compartilhamentos)
  const withReach = d.basePosts.filter((p) => (p.reach ?? 0) > 0);
  if (withReach.length >= 5) {
    const saveRate = (p: MediaRow) => (p.saves ?? 0) / (p.reach || 1);
    const topSave = [...withReach].sort((a, b) => saveRate(b) - saveRate(a))[0];
    const avgSave = avg(withReach.map(saveRate));
    if (topSave && saveRate(topSave) > avgSave * 1.8 && (topSave.saves ?? 0) >= 5) {
      out.push({
        tone: "positive",
        title: "Conteúdo salvo como referência",
        text: `“${(topSave.caption ?? "Publicação").split("\n")[0].slice(0, 70)}” teve ${n(topSave.saves ?? 0)} salvamentos, ${(saveRate(topSave) / avgSave).toFixed(1).replace(".", ",")}× a média. Salvamento indica material que o leitor pretende consultar de novo: bom candidato a novo guia em PDF.`,
      });
    }
    const topShare = [...withReach].sort((a, b) => (b.shares ?? 0) - (a.shares ?? 0))[0];
    if (topShare && (topShare.shares ?? 0) >= 5 && topShare.id !== topSave?.id) {
      out.push({
        tone: "positive",
        title: "Conteúdo mais encaminhado",
        text: `“${(topShare.caption ?? "Publicação").split("\n")[0].slice(0, 70)}” foi compartilhado ${n(topShare.shares ?? 0)} vezes. Compartilhamento é indicação direta, geralmente entre sócios e decisores.`,
      });
    }
  }

  // Melhor dia da semana
  const byDay = new Map<number, number[]>();
  for (const p of withReach) {
    const wd = new Date(new Date(p.posted_at).getTime() - TZ_OFFSET_H * 3600_000).getUTCDay();
    byDay.set(wd, [...(byDay.get(wd) ?? []), p.reach!]);
  }
  const days = [...byDay.entries()].filter(([, v]) => v.length >= 2).map(([wd, v]) => ({ wd, avg: avg(v), count: v.length })).sort((a, b) => b.avg - a.avg);
  if (days.length >= 3 && days[0].avg >= avg(withReach.map((p) => p.reach!)) * 1.2) {
    out.push({
      tone: "neutral",
      title: `Publicações de ${WEEKDAYS[days[0].wd]} rendem mais`,
      text: `Alcance médio de ${n(days[0].avg)} contas em ${days[0].count} publicações feitas nesse dia, acima da média geral. Base: últimos ${Math.max(d.period, 90)} dias.`,
    });
  }

  // Automação: pedidos de material por publicação
  const leadPosts = d.basePosts.filter((p) => p.leads > 0).sort((a, b) => b.leads - a.leads);
  if (leadPosts.length) {
    const total = leadPosts.reduce((a, p) => a + p.leads, 0);
    const top = leadPosts[0];
    out.push({
      tone: "positive",
      title: `${n(total)} pedidos de material pelos comentários`,
      text: `A publicação que mais gerou pedidos foi “${(top.caption ?? "Publicação").split("\n")[0].slice(0, 60)}”, com ${n(top.leads)}. Publicações com chamada “comente” convertem atenção em contato identificado.`,
    });
  } else if (d.basePosts.length >= 3) {
    out.push({
      tone: "attention",
      title: "Nenhum pedido de material no período",
      text: "Nenhuma publicação recente gerou comentário com palavra-chave. Vale incluir a chamada “Comente MAPA” (ou outra palavra ativa) nas próximas legendas.",
    });
  }

  // Audiência-alvo: empresários brasileiros
  const countries = d.audience.filter((a) => a.kind === "country");
  const totalC = countries.reduce((a, c) => a + c.value, 0);
  if (totalC >= 100) {
    const br = countries.find((c) => c.key === "BR")?.value ?? 0;
    const py = countries.find((c) => c.key === "PY")?.value ?? 0;
    out.push({
      tone: br / totalC >= 0.5 ? "positive" : "neutral",
      title: `${pct(br / totalC)} da audiência está no Brasil`,
      text: `Brasil ${pct(br / totalC)}, Paraguai ${pct(py / totalC)}. O público prioritário do parque é o empresário brasileiro com interesse em operar no Paraguai.`,
    });
  }

  // Toques em links do perfil
  if (d.cur.taps > 0 && d.cur.reach > 0) {
    out.push({
      tone: "neutral",
      title: `${n(d.cur.taps)} toques nos links do perfil`,
      text: `Equivale a ${(d.cur.taps / d.cur.reach * 1000).toFixed(1).replace(".", ",")} toques a cada mil contas alcançadas. É o termômetro de quem saiu do Instagram para o site ou para o contato.`,
    });
  }

  return out;
}
