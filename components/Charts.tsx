// Gráficos em SVG renderizados no servidor, uma série por gráfico, na cor de acento da marca.
// Especificações: linha de 2 px, área a 10%, barras até 24 px com topo arredondado de 4 px,
// grade em linha fina e recessiva, rótulo apenas no valor final ou no pico. O detalhe de cada
// ponto aparece ao passar o cursor (title), e a tabela do período fica logo abaixo.

const W = 720;
const INK_MUTED = "var(--muted)";
const GRID = "var(--line)";
const MARK = "var(--accent)";
const SURFACE = "var(--paper)";

type Point = { label: string; value: number | null };

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v);
const fmtFull = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const dayLabel = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};

function niceTicks(min: number, max: number, count = 3): number[] {
  if (max === min) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 0.001; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

export function LineChart({ data, height = 220, label }: { data: Point[]; height?: number; label: string }) {
  const pts = data.filter((p) => p.value !== null) as { label: string; value: number }[];
  if (pts.length < 2) return <p className="muted small">Histórico em formação: o gráfico aparece a partir do segundo dia de coleta.</p>;

  const padL = 56, padR = 72, padT = 16, padB = 28;
  const values = pts.map((p) => p.value);
  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  const ticks = niceTicks(lo, hi);
  const yMin = Math.min(lo, ticks[0]), yMax = Math.max(hi, ticks[ticks.length - 1]);
  const x = (i: number) => padL + (i / (pts.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * (height - padT - padB);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${height - padB} L${x(0).toFixed(1)},${height - padB} Z`;
  const last = pts[pts.length - 1];
  const band = (W - padL - padR) / (pts.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label} style={{ display: "block", overflow: "visible" }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK_MUTED}>{fmt(t)}</text>
        </g>
      ))}
      <path d={area} fill={MARK} opacity={0.1} />
      <path d={line} fill="none" stroke={MARK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(last.value)} r={4} fill={MARK} stroke={SURFACE} strokeWidth={2} />
      <text x={x(pts.length - 1) + 10} y={y(last.value) + 4} fontSize={12} fontWeight={600} fill="var(--ink)">{fmtFull(last.value)}</text>
      <text x={padL} y={height - 8} fontSize={11} fill={INK_MUTED}>{dayLabel(pts[0].label)}</text>
      <text x={W - padR} y={height - 8} fontSize={11} fill={INK_MUTED} textAnchor="end">{dayLabel(last.label)}</text>
      {pts.map((p, i) => (
        <rect key={p.label} x={x(i) - band / 2} y={padT} width={band} height={height - padT - padB} fill="transparent" className="hit">
          <title>{`${dayLabel(p.label)} · ${fmtFull(p.value)}`}</title>
        </rect>
      ))}
    </svg>
  );
}

export function ColumnChart({ data, height = 220, label }: { data: Point[]; height?: number; label: string }) {
  const pts = data.map((p) => ({ label: p.label, value: p.value ?? 0 }));
  if (!pts.some((p) => p.value > 0)) return <p className="muted small">Sem dados no período.</p>;

  const padL = 56, padR = 16, padT = 22, padB = 28;
  const max = Math.max(...pts.map((p) => p.value));
  const ticks = niceTicks(0, max);
  const yMax = Math.max(max, ticks[ticks.length - 1]);
  const band = (W - padL - padR) / pts.length;
  const bw = Math.min(24, Math.max(2, band - 2));
  const y = (v: number) => padT + (1 - v / (yMax || 1)) * (height - padT - padB);
  const base = height - padB;
  const peak = pts.reduce((a, p, i) => (p.value > pts[a].value ? i : a), 0);

  const bar = (i: number, v: number) => {
    const x0 = padL + i * band + (band - bw) / 2;
    const top = y(v);
    const r = Math.min(4, bw / 2, base - top);
    return `M${x0},${base} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x0 + bw - r},${top} Q${x0 + bw},${top} ${x0 + bw},${top + r} L${x0 + bw},${base} Z`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label} style={{ display: "block", overflow: "visible" }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK_MUTED}>{fmt(t)}</text>
        </g>
      ))}
      {pts.map((p, i) => (
        <g key={p.label} className="hit">
          <rect x={padL + i * band} y={padT} width={band} height={base - padT} fill="transparent" />
          {p.value > 0 && <path d={bar(i, p.value)} fill={MARK} />}
          <title>{`${dayLabel(p.label)} · ${fmtFull(p.value)}`}</title>
        </g>
      ))}
      <text x={padL + peak * band + band / 2} y={y(pts[peak].value) - 7} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--ink)">
        {fmt(pts[peak].value)}
      </text>
      <text x={padL} y={height - 8} fontSize={11} fill={INK_MUTED}>{dayLabel(pts[0].label)}</text>
      <text x={W - padR} y={height - 8} fontSize={11} fill={INK_MUTED} textAnchor="end">{dayLabel(pts[pts.length - 1].label)}</text>
    </svg>
  );
}

/** Barras horizontais em HTML: rótulo, barra e valor, para distribuições e comparações. */
export function HBars({ rows, format = "pct", note }: { rows: { label: string; value: number; sub?: string }[]; format?: "pct" | "int"; note?: string }) {
  if (!rows.length) return <p className="muted small">{note ?? "Sem dados suficientes."}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.label} title={`${r.label} · ${fmtFull(Math.round(r.value))}`}>
          <span className="hbar-label">{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <span className="hbar-track"><span style={{ width: `${Math.max(2, (r.value / (max || 1)) * 100)}%` }} /></span>
          <span className="hbar-value">{format === "pct" ? `${Math.round((r.value / (total || 1)) * 100)}%` : fmtFull(Math.round(r.value))}</span>
        </div>
      ))}
    </div>
  );
}
