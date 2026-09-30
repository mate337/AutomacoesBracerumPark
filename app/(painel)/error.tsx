"use client";

export default function PanelError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="empty">
      <div>
        <p className="eyebrow">Indisponível no momento</p>
        <h2 className="h2">Não foi possível carregar esta página.</h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Verifique em Configurações se o banco de dados e a conta do Instagram estão conectados. O detalhe técnico fica
          registrado nos logs da Vercel.
        </p>
      </div>
      <button className="btn" onClick={reset}>Tentar novamente</button>
    </div>
  );
}
