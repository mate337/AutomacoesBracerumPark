"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !on }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert((data.errors ?? ["Não foi possível alterar."]).join("\n"));
      return;
    }
    setOn(!on);
    router.refresh();
  }

  return (
    <button type="button" className="switch" role="switch" aria-checked={on} onClick={toggle} disabled={busy}>
      <span className="switch-track" />
      <span>{on ? "Ativa" : "Pausada"}</span>
    </button>
  );
}
