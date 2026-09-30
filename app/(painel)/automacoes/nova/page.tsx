import Link from "next/link";
import AutomationForm, { type FormState } from "@/components/AutomationForm";
import { TEMPLATES, BLANK_CONTENT } from "@/lib/defaults";

export default async function Nova({ searchParams }: { searchParams: Promise<{ modelo?: string }> }) {
  const { modelo } = await searchParams;

  if (!modelo) {
    return (
      <>
        <div className="page-head">
          <div>
            <p className="eyebrow">Nova automação</p>
            <h1 className="display">Escolha o <em>ponto de partida</em>.</h1>
            <p className="lede">Os modelos já trazem os textos aprovados dos guias por mensagem, em português e espanhol. Tudo pode ser ajustado.</p>
          </div>
        </div>
        <div className="templates">
          {TEMPLATES.map((t) => (
            <Link key={t.key} href={`/automacoes/nova?modelo=${t.key}`} className="template">
              <span className="kw">{t.keywords.join(" · ")}</span>
              <span className="t">{t.name}</span>
              <span className="d">{t.summary}</span>
            </Link>
          ))}
          <Link href="/automacoes/nova?modelo=branco" className="template">
            <span className="kw">EM BRANCO</span>
            <span className="t">Automação personalizada</span>
            <span className="d">Estrutura padrão para um novo material.</span>
          </Link>
        </div>
      </>
    );
  }

  const t = TEMPLATES.find((x) => x.key === modelo);
  const initial: FormState = {
    name: t?.name ?? "",
    keywords: t?.keywords ?? [],
    match_mode: "contains",
    post_ids: [],
    delivery_mode: "button",
    public_reply: true,
    default_lang: "pt",
    content: structuredClone(t?.content ?? BLANK_CONTENT),
    pdf_url: null,
    pdf_name: null,
    pdf_size: null,
    active: false,
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow"><Link href="/automacoes/nova">Nova automação</Link> / {t?.name ?? "Personalizada"}</p>
          <h1 className="display">{t ? <>Comente <em>{t.keywords[0]}</em>.</> : <>Nova <em>automação</em>.</>}</h1>
        </div>
      </div>
      <AutomationForm initial={initial} />
    </>
  );
}
