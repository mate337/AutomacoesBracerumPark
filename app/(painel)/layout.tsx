import Link from "next/link";
import Nav from "@/components/Nav";
import { ensureSchema } from "@/lib/db";
import { databaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

async function setupProblem(): Promise<string | null> {
  if (!databaseUrl()) return "database";
  try {
    await ensureSchema();
    return null;
  } catch (e: any) {
    console.error("[setup]", e);
    return `connection:${e?.message ?? e}`;
  }
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const problem = await setupProblem();

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-mark">BRACERUM PARK</span>
          <span className="brand-sub">Central Instagram</span>
        </Link>
        <Nav />
      </header>
      <main className="main">{problem ? <Setup problem={problem} /> : children}</main>
      <footer className="foot">
        <span>Bracerum Park · PY-19, km 35 · Villeta, Paraguai</span>
        <span>Uso interno</span>
      </footer>
    </div>
  );
}

function Setup({ problem }: { problem: string }) {
  const missingDb = problem === "database";
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Configuração inicial</p>
          <h1 className="display">Falta conectar o <em>banco de dados</em>.</h1>
          <p className="lede">
            {missingDb
              ? "O painel está no ar, mas ainda não há um banco conectado ao projeto na Vercel. As tabelas são criadas automaticamente assim que ele for conectado."
              : "O banco está cadastrado, mas a conexão falhou. Confira se a variável aponta para o banco correto."}
          </p>
        </div>
      </div>
      {!missingDb && <div className="notice notice-err"><span className="mono">{problem.slice(11)}</span></div>}
      <ol className="steps">
        <li>Na Vercel, abra o projeto e vá em <strong>Storage › Create Database</strong>. Escolha <strong>Neon</strong> (Postgres serverless), plano gratuito, na região mais próxima do Brasil que estiver disponível.</li>
        <li>Ao concluir, clique em <strong>Connect Project</strong> e selecione este projeto, com os três ambientes marcados. A variável <span className="mono">DATABASE_URL</span> é criada sozinha.</li>
        <li>Ainda em <strong>Storage</strong>, crie também um <strong>Blob</strong> e conecte ao projeto. Ele guarda os PDFs.</li>
        <li>Em <strong>Deployments</strong>, faça <strong>Redeploy</strong> do último deploy e recarregue esta página.</li>
      </ol>
    </>
  );
}
