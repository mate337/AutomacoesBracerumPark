import { Fragment } from "react";
import { headers } from "next/headers";
import { getSetting } from "@/lib/db";
import { getAccount, type Account } from "@/lib/instagram";
import { fmtDate, fmtInt } from "@/lib/format";
import { TokenForm, RefreshButton, CopyField } from "@/components/TokenForm";

export const dynamic = "force-dynamic";

export default async function Configuracoes() {
  const h = await headers();
  const origin = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || `https://${h.get("host")}`;

  let account: Account | null = null;
  let accountError: string | null = null;
  try {
    account = await getAccount();
  } catch (e: any) {
    accountError = e.message;
  }
  const expires = await getSetting("ig_token_expires_at");

  const env = [
    ["Banco de dados", !!(process.env.DATABASE_URL || process.env.POSTGRES_URL)],
    ["Armazenamento de PDFs", !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)],
    ["Chave secreta do app", !!process.env.INSTAGRAM_APP_SECRET],
    ["Token de verificação do webhook", !!process.env.IG_WEBHOOK_VERIFY_TOKEN],
    ["Renovação automática", !!process.env.CRON_SECRET],
  ] as const;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Configurações</p>
          <h1 className="display">Conexão com o <em>Instagram</em>.</h1>
        </div>
      </div>

      <div className="grid-2">
        <section>
          <h2 className="h3" style={{ marginBottom: 18 }}>Conta conectada</h2>
          {account ? (
            <div className="kv">
              <div>Perfil</div><div><a href={`https://instagram.com/${account.username}`} target="_blank" rel="noreferrer">@{account.username}</a></div>
              <div>Seguidores</div><div>{fmtInt(account.followers_count)}</div>
              <div>Publicações</div><div>{fmtInt(account.media_count)}</div>
              <div>Validade do token</div><div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {expires ? fmtDate(expires) : "—"} <RefreshButton />
              </div>
            </div>
          ) : (
            <div className="notice notice-err">{accountError ?? "Nenhuma conta conectada."}</div>
          )}
          <div style={{ marginTop: 32 }}>
            <h2 className="h3" style={{ marginBottom: 18 }}>{account ? "Substituir token" : "Conectar conta"}</h2>
            <TokenForm />
          </div>
        </section>

        <section>
          <h2 className="h3" style={{ marginBottom: 18 }}>Webhook na Meta</h2>
          <div className="kv">
            <div>URL de retorno</div><div><CopyField value={`${origin}/api/webhooks/instagram`} /></div>
            <div>Campos assinados</div><div className="mono">comments · messages · messaging_postbacks</div>
            <div>Links dos materiais</div><div className="mono">{origin}/m/…</div>
          </div>

          <h2 className="h3" style={{ margin: "36px 0 18px" }}>Variáveis do servidor</h2>
          <div className="kv">
            {env.map(([label, ok]) => (
              <Fragment key={label}><div>{label}</div><div><span className={`badge ${ok ? "badge-ok" : "badge-err"}`}>{ok ? "Configurado" : "Ausente"}</span></div></Fragment>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
