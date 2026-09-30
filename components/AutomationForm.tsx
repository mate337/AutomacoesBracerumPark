"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload, uploadPresigned } from "@vercel/blob/client";
import type { AutomationContent, DeliveryMode, Lang, MatchMode } from "@/lib/types";
import { fillTemplate, parseKeywords, normalize } from "@/lib/text";
import { fmtSize } from "@/lib/format";

type Media = { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string };

export type FormState = {
  name: string;
  keywords: string[];
  match_mode: MatchMode;
  post_ids: string[];
  delivery_mode: DeliveryMode;
  public_reply: boolean;
  default_lang: Lang;
  content: AutomationContent;
  pdf_url: string | null;
  pdf_name: string | null;
  pdf_size: number | null;
  active: boolean;
};

const LANG_LABEL: Record<Lang, string> = { pt: "Português", es: "Español" };

export default function AutomationForm({ id, initial, slug }: { id?: string; initial: FormState; slug?: string }) {
  const router = useRouter();
  const [s, setS] = useState<FormState>(initial);
  const [lang, setLang] = useState<Lang>("pt");
  const [kwDraft, setKwDraft] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [media, setMedia] = useState<Media[] | null>(null);
  const [mediaErr, setMediaErr] = useState<string | null>(null);
  const [scopeSelected, setScopeSelected] = useState(initial.post_ids.length > 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    dirty.current = true;
    setS((p) => ({ ...p, [key]: value }));
  }
  function setLangField(path: "publicReplies" | "openingText" | "openingButton" | "delivery", value: string) {
    dirty.current = true;
    setS((p) => {
      const c = { ...p.content[lang] };
      if (path === "publicReplies") c.publicReplies = value.split("\n");
      if (path === "openingText") c.opening = { ...c.opening, text: value };
      if (path === "openingButton") c.opening = { ...c.opening, button: value };
      if (path === "delivery") c.delivery = { text: value };
      return { ...p, content: { ...p.content, [lang]: c } };
    });
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    if (!scopeSelected || media) return;
    fetch("/api/media").then((r) => r.json()).then((d) => {
      setMedia(d.media ?? []);
      if (d.error) setMediaErr(d.error);
    }).catch(() => setMediaErr("Não foi possível carregar as publicações."));
  }, [scopeSelected, media]);

  function addKeywords(raw: string) {
    const next = parseKeywords([...s.keywords, ...raw.split(/[,;\n]/)]);
    set("keywords", next);
    setKwDraft("");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") return setErrors(["Envie um arquivo em PDF."]);
    if (file.size > 25 * 1024 * 1024) return setErrors(["O PDF deve ter até 25 MB. Para envio no celular, o ideal é até 5 MB."]);
    setErrors([]);
    setProgress(0);
    try {
      const base = normalize(s.keywords[0] || s.name || "material").replace(/\s+/g, "-") || "material";
      const { mode } = await fetch("/api/upload").then((r) => r.json());
      if (mode === "none") throw new Error("o armazenamento de PDFs (Blob) ainda não está conectado ao projeto");
      const send = mode === "presigned" ? uploadPresigned : upload;
      const blob = await send(`materiais/${base}.pdf`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: "application/pdf",
        onUploadProgress: (e) => setProgress(e.percentage),
      });
      dirty.current = true;
      setS((p) => ({ ...p, pdf_url: blob.url, pdf_name: file.name, pdf_size: file.size }));
    } catch (e: any) {
      setErrors([`Falha no envio do PDF: ${e.message}`]);
    } finally {
      setProgress(null);
    }
  }

  async function save(activate?: boolean) {
    setSaving(true);
    setErrors([]);
    const payload = {
      ...s,
      keywords: parseKeywords([...s.keywords, kwDraft]),
      post_ids: scopeSelected ? s.post_ids : [],
      active: activate ?? s.active,
    };
    const res = await fetch(id ? `/api/automations/${id}` : "/api/automations", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setErrors(data.errors ?? ["Não foi possível salvar."]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    dirty.current = false;
    router.push("/");
    router.refresh();
  }

  async function remove() {
    if (!id || !confirm("Excluir esta automação? O histórico de entregas é mantido.")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    dirty.current = false;
    router.push("/");
    router.refresh();
  }

  const c = s.content[lang];
  const btnLen = c.opening.button.length;

  return (
    <div className="editor">
      <div>
        {errors.length > 0 && (
          <div className="notice notice-err" role="alert">
            <div>
              <strong>Revise antes de salvar</strong>
              <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          </div>
        )}

        {/* 01 · Identificação e gatilho */}
        <section className="section">
          <div className="section-label">
            <div className="n">01</div>
            <div className="h3">Gatilho</div>
            <p>O que a pessoa comenta e onde.</p>
          </div>
          <div>
            <div className="field">
              <label className="label" htmlFor="name">Nome interno</label>
              <input id="name" className="input input-lg" value={s.name} placeholder="Mapa logístico" onChange={(e) => set("name", e.target.value)} />
            </div>

            <div className="field">
              <span className="label">Palavras-chave</span>
              <div className="kw-input" onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
                {s.keywords.map((k) => (
                  <span className="chip" key={k}>
                    {k}
                    <button type="button" aria-label={`Remover ${k}`} onClick={() => set("keywords", s.keywords.filter((x) => x !== k))}>×</button>
                  </span>
                ))}
                <input
                  value={kwDraft}
                  placeholder={s.keywords.length ? "" : "MAPA"}
                  onChange={(e) => setKwDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && kwDraft.trim()) { e.preventDefault(); addKeywords(kwDraft); }
                    if (e.key === "Backspace" && !kwDraft && s.keywords.length) set("keywords", s.keywords.slice(0, -1));
                  }}
                  onBlur={() => kwDraft.trim() && addKeywords(kwDraft)}
                />
              </div>
              <span className="hint">Pressione Enter para incluir. Acentos, maiúsculas e pontuação são ignorados: “mapa”, “Mapa!” e “MAPA” acionam igual.</span>
            </div>

            <div className="field">
              <span className="label">Como reconhecer</span>
              <div className="choice">
                <button type="button" aria-pressed={s.match_mode === "contains"} onClick={() => set("match_mode", "contains")}>
                  <strong>Contém a palavra</strong>
                  <span>“Quero o mapa, por favor” aciona.</span>
                </button>
                <button type="button" aria-pressed={s.match_mode === "exact"} onClick={() => set("match_mode", "exact")}>
                  <strong>Somente a palavra</strong>
                  <span>Apenas “MAPA” aciona. Mais preciso.</span>
                </button>
              </div>
            </div>

            <div className="field">
              <span className="label">Publicações</span>
              <div className="seg">
                <button type="button" aria-pressed={!scopeSelected} onClick={() => { setScopeSelected(false); dirty.current = true; }}>Todas</button>
                <button type="button" aria-pressed={scopeSelected} onClick={() => { setScopeSelected(true); dirty.current = true; }}>Selecionadas</button>
              </div>
              {scopeSelected && (
                <>
                  {!media && !mediaErr && <span className="hint">Carregando publicações…</span>}
                  {mediaErr && <span className="hint" style={{ color: "var(--err)" }}>{mediaErr}</span>}
                  {media && (
                    <div className="posts">
                      {media.map((m) => {
                        const on = s.post_ids.includes(m.id);
                        return (
                          <button
                            type="button" key={m.id} className="post" aria-pressed={on} title={m.caption?.slice(0, 120)}
                            onClick={() => set("post_ids", on ? s.post_ids.filter((x) => x !== m.id) : [...s.post_ids, m.id])}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.thumbnail_url || m.media_url} alt="" loading="lazy" />
                            {on && <span className="tick">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <span className="hint">{s.post_ids.length} selecionada(s). Publicações futuras precisam ser incluídas aqui.</span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* 02 · Entrega */}
        <section className="section">
          <div className="section-label">
            <div className="n">02</div>
            <div className="h3">Entrega</div>
            <p>Como o material chega ao Direct.</p>
          </div>
          <div>
            <div className="field">
              <div className="choice">
                <button type="button" aria-pressed={s.delivery_mode === "button"} onClick={() => set("delivery_mode", "button")}>
                  <strong>PDF anexado · recomendado</strong>
                  <span>Primeira mensagem com botão. Ao tocar, a pessoa recebe o PDF no próprio Direct.</span>
                </button>
                <button type="button" aria-pressed={s.delivery_mode === "direct"} onClick={() => set("delivery_mode", "direct")}>
                  <strong>Link imediato</strong>
                  <span>O link do PDF segue já na primeira mensagem, sem etapa intermediária.</span>
                </button>
              </div>
            </div>

            <div className="field">
              <span className="label">Material em PDF</span>
              {s.pdf_url ? (
                <div className="file-card">
                  <div className="file-icon">PDF</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.pdf_name}</div>
                    <div className="hint">
                      {fmtSize(s.pdf_size)}
                      {(s.pdf_size ?? 0) > 5 * 1024 * 1024 && " · acima de 5 MB, pode demorar a abrir no celular"}
                    </div>
                  </div>
                  <a className="btn btn-ghost btn-sm" href={s.pdf_url} target="_blank" rel="noreferrer">Abrir</a>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Substituir</button>
                </div>
              ) : (
                <div
                  className={`drop ${over ? "is-over" : ""}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}
                >
                  <div className="h3" style={{ marginBottom: 6 }}>Arraste o PDF aqui</div>
                  <div className="hint">ou clique para escolher · até 25 MB · ideal até 5 MB</div>
                </div>
              )}
              {progress !== null && <div className="progress"><div style={{ width: `${progress}%` }} /></div>}
              <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>

            <div className="field">
              <button type="button" className="switch" role="switch" aria-checked={s.public_reply} onClick={() => set("public_reply", !s.public_reply)}>
                <span className="switch-track" />
                <span>Responder publicamente no comentário</span>
              </button>
              <span className="hint">Sinaliza a quem vê a publicação que o material foi enviado, e estimula novos comentários.</span>
            </div>
          </div>
        </section>

        {/* 03 · Mensagens */}
        <section className="section">
          <div className="section-label">
            <div className="n">03</div>
            <div className="h3">Mensagens</div>
            <p>O idioma é detectado no comentário. Sem sinal claro, vale o padrão.</p>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div className="tabs" role="tablist">
                {(["pt", "es"] as Lang[]).map((l) => (
                  <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}>{LANG_LABEL[l]}</button>
                ))}
              </div>
              <label className="small muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                Idioma padrão
                <select className="select" style={{ width: "auto", padding: "6px 10px" }} value={s.default_lang} onChange={(e) => set("default_lang", e.target.value as Lang)}>
                  <option value="pt">Português</option>
                  <option value="es">Español</option>
                </select>
              </label>
            </div>

            {s.public_reply && (
              <div className="field">
                <label className="label" htmlFor="pub">Respostas públicas <span className="count">uma por linha · sorteadas</span></label>
                <textarea id="pub" className="textarea" rows={3} value={c.publicReplies.join("\n")} onChange={(e) => setLangField("publicReplies", e.target.value)} />
                <span className="hint">Variar o texto evita que o Instagram trate as respostas como repetitivas.</span>
              </div>
            )}

            {s.delivery_mode === "button" && (
              <>
                <div className="field">
                  <label className="label" htmlFor="open">Mensagem de abertura <span className="count">{c.opening.text.length}/640</span></label>
                  <textarea id="open" className="textarea" rows={3} value={c.opening.text} onChange={(e) => setLangField("openingText", e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="btn">Texto do botão <span className={`count ${btnLen > 20 ? "over" : ""}`}>{btnLen}/20</span></label>
                  <input id="btn" className="input" value={c.opening.button} onChange={(e) => setLangField("openingButton", e.target.value)} />
                </div>
              </>
            )}

            <div className="field">
              <label className="label" htmlFor="deliv">Mensagem de entrega <span className="count">{c.delivery.text.length}/1000</span></label>
              <textarea id="deliv" className="textarea" rows={6} value={c.delivery.text} onChange={(e) => setLangField("delivery", e.target.value)} />
              <span className="hint">
                <b>{"{nome}"}</b> insere o primeiro nome (ou o @ quando o nome não estiver disponível). <b>{"{link}"}</b> marca onde o PDF entra:
                o texto antes segue primeiro, depois o arquivo, depois o restante.
              </span>
            </div>
          </div>
        </section>

        <div className="actions">
          {id && <button type="button" className="btn btn-danger" onClick={remove}>Excluir</button>}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" disabled={saving || progress !== null} onClick={() => save(false)}>
            {s.active ? "Salvar e pausar" : "Salvar como rascunho"}
          </button>
          <button type="button" className="btn" disabled={saving || progress !== null} onClick={() => save(true)}>
            {saving ? "Salvando…" : s.active ? "Salvar alterações" : "Salvar e ativar"}
          </button>
        </div>
      </div>

      <aside className="preview-col">
        <p className="eyebrow">Pré-visualização · {LANG_LABEL[lang]}</p>
        <Preview state={s} lang={lang} slug={slug} />
      </aside>
    </div>
  );
}

function Preview({ state, lang, slug }: { state: FormState; lang: Lang; slug?: string }) {
  const c = state.content[lang];
  const vars = { nome: "Carlos Mendes", usuario: "carlos.mendes" };
  const kw = state.keywords[0] || "MAPA";
  const reply = c.publicReplies.find((r) => r.trim()) ?? "";
  const link = `…/m/${slug || normalize(kw).replace(/\s+/g, "-")}`;
  const [before, after] = useMemo(() => {
    const t = c.delivery.text;
    const i = t.search(/\{link\}/i);
    return i < 0 ? [t, ""] : [t.slice(0, i).trim(), t.slice(i + 6).trim()];
  }, [c.delivery.text]);

  return (
    <div className="phone">
      <div className="phone-screen">
        <div className="phone-head">
          <span className="avatar">BP</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>bracerumpark</div>
            <div style={{ fontSize: 11, color: "#999" }}>Comentários e Direct</div>
          </div>
        </div>
        <div className="thread">
          <div className="comment"><span className="avatar alt">CM</span><div><b>carlos.mendes</b>{kw.toLowerCase()}</div></div>
          {state.public_reply && reply && (
            <div className="comment reply"><span className="avatar" style={{ width: 22, height: 22, fontSize: 8 }}>BP</span><div><b>bracerumpark</b>{fillTemplate(reply, vars)}</div></div>
          )}
          <div className="sep">Direct</div>
          {state.delivery_mode === "button" ? (
            <>
              <div className="bubble btn-card">
                <p>{fillTemplate(c.opening.text, { usuario: vars.usuario })}</p>
                <div>{c.opening.button || "Receber"}</div>
              </div>
              <div className="bubble out">{c.opening.button || "Receber"}</div>
              {before && <div className="bubble in">{fillTemplate(before, vars)}</div>}
              <div className="bubble pdf">
                <div className="file-icon" style={{ width: 28, height: 36, fontSize: 7, background: "#fff" }}>PDF</div>
                <div><b>{state.pdf_name || "material.pdf"}</b><span style={{ fontSize: 11, color: "#777" }}>{fmtSize(state.pdf_size) || "PDF"}</span></div>
              </div>
              {after && <div className="bubble in">{fillTemplate(after, vars)}</div>}
            </>
          ) : (
            <div className="bubble in">{fillTemplate(c.delivery.text, { usuario: vars.usuario, link })}{/\{link\}/i.test(c.delivery.text) ? "" : `\n${link}`}</div>
          )}
        </div>
      </div>
    </div>
  );
}
