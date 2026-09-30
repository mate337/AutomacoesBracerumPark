export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="login">
      <aside className="login-art">
        <div className="brand">
          <span className="brand-mark">BRACERUM PARK</span>
          <span className="brand-sub" style={{ color: "#b9b2a4" }}>Villeta · Paraguai</span>
        </div>
        <div>
          <p className="eyebrow" style={{ color: "#c9a878" }}>Central de relacionamento</p>
          <h1 className="display">Cada comentário, <em>uma conversa</em>.</h1>
        </div>
        <p className="small" style={{ color: "#b9b2a4", margin: 0 }}>Automações de Instagram · uso interno</p>
      </aside>
      <main className="login-form">
        <p className="eyebrow">Acesso restrito</p>
        <h2 className="h2" style={{ marginBottom: 28 }}>Entrar no painel</h2>
        {sp.erro && <div className="notice notice-err">Senha incorreta. Tente novamente.</div>}
        <form method="post" action="/api/auth/login">
          <input type="hidden" name="next" value={sp.next ?? "/"} />
          <div className="field">
            <label className="label" htmlFor="password">Senha</label>
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          </div>
          <button className="btn" type="submit" style={{ width: "100%", marginTop: 8 }}>Entrar</button>
        </form>
      </main>
    </div>
  );
}
