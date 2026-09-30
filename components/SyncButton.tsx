"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton({ first }: { first?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setMsg(first ? "Coletando os últimos 30 dias. Pode levar até um minuto." : null);
    const res = await fetch("/api/analytics/sync", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !d.ok) return setMsg(d.error ?? "Não foi possível atualizar.");
    setMsg(d.errors?.length ? `Atualizado, com ${d.errors.length} dia(s) indisponível(is) na Meta.` : "Dados atualizados.");
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button className={first ? "btn" : "btn btn-ghost"} onClick={run} disabled={busy}>
        {busy ? "Atualizando…" : first ? "Fazer a primeira coleta" : "Atualizar agora"}
      </button>
      {msg && <span className="small muted">{msg}</span>}
    </span>
  );
}
