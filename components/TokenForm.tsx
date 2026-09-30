"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TokenForm() {
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error ?? "Não foi possível validar." });
    setToken("");
    setMsg({ ok: true, text: `Conta @${d.username} conectada.` });
    router.refresh();
  }

  return (
    <div>
      <div className="field">
        <label className="label" htmlFor="tk">Token de acesso do Instagram</label>
        <textarea id="tk" className="textarea mono" rows={3} value={token} onChange={(e) => setToken(e.target.value)} placeholder="IGAA…" />
        <span className="hint">Gerado no Painel da Meta, em Instagram › Configuração da API com login do Instagram › Gerar token.</span>
      </div>
      <button className="btn" disabled={busy || !token.trim()} onClick={save}>{busy ? "Validando…" : "Validar e salvar"}</button>
      {msg && <p className="small" style={{ color: msg.ok ? "var(--ok)" : "var(--err)" }}>{msg.text}</p>}
    </div>
  );
}

export function RefreshButton() {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function run() {
    setBusy(true);
    const res = await fetch("/api/settings/refresh", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setText(res.ok ? "Token renovado por mais 60 dias." : d.error ?? "Falha na renovação.");
    router.refresh();
  }
  return (
    <span style={{ display: "inline-flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={run}>{busy ? "Renovando…" : "Renovar agora"}</button>
      {text && <span className="small muted">{text}</span>}
    </span>
  );
}

export function CopyField({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <span className="copy">
      <span className="mono">{value}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }}>
        {ok ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}
