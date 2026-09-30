import { q } from "./db";
import { parseKeywords, normalize, slugify } from "./text";
import type { Automation, AutomationContent, Lang } from "./types";
import { LANGS } from "./types";

export type Payload = {
  name?: string;
  keywords?: string[] | string;
  match_mode?: string;
  post_ids?: string[];
  delivery_mode?: string;
  public_reply?: boolean;
  default_lang?: string;
  content?: AutomationContent;
  pdf_url?: string | null;
  pdf_name?: string | null;
  pdf_size?: number | null;
  active?: boolean;
};

/** Valida e normaliza os dados. Devolve a lista de problemas em linguagem clara. */
export async function validate(p: Payload, currentId?: string) {
  const errors: string[] = [];
  const name = (p.name ?? "").trim();
  const keywords = parseKeywords(p.keywords ?? []);
  const match_mode = p.match_mode === "exact" ? "exact" : "contains";
  const delivery_mode = p.delivery_mode === "direct" ? "direct" : "button";
  const default_lang: Lang = p.default_lang === "es" ? "es" : "pt";
  const post_ids = Array.isArray(p.post_ids) ? p.post_ids.filter((x) => typeof x === "string" && x) : [];
  const active = !!p.active;
  const content = p.content as AutomationContent;

  if (!name) errors.push("Informe um nome para a automação.");
  if (!keywords.length) errors.push("Inclua ao menos uma palavra-chave.");
  if (!content) errors.push("Mensagens ausentes.");
  else {
    for (const l of LANGS) {
      const c = content[l];
      const label = l === "pt" ? "Português" : "Espanhol";
      if (!c) { errors.push(`Textos em ${label} ausentes.`); continue; }
      c.publicReplies = (c.publicReplies ?? []).map((s) => s.trim()).filter(Boolean);
      if (p.public_reply !== false && !c.publicReplies.length) errors.push(`${label}: inclua ao menos uma resposta pública.`);
      if (delivery_mode === "button") {
        if (!c.opening?.text?.trim()) errors.push(`${label}: escreva a mensagem de abertura.`);
        if (!c.opening?.button?.trim()) errors.push(`${label}: defina o texto do botão.`);
        else if (c.opening.button.trim().length > 20) errors.push(`${label}: o botão aceita até 20 caracteres.`);
      }
      if (!c.delivery?.text?.trim()) errors.push(`${label}: escreva a mensagem de entrega.`);
      for (const t of [c.opening?.text, c.delivery?.text, ...c.publicReplies]) {
        if (t && t.length > 1000) errors.push(`${label}: cada mensagem aceita até 1.000 caracteres.`);
      }
    }
  }
  if (active && !p.pdf_url) errors.push("Anexe o PDF antes de ativar.");
  if (p.pdf_size && p.pdf_size > 25 * 1024 * 1024) errors.push("O PDF deve ter até 25 MB.");

  if (active && keywords.length) {
    const others = await q<{ name: string; keywords: string[]; post_ids: string[] }>`
      select name, keywords, post_ids from automations where active = true and id <> ${currentId ?? "00000000-0000-0000-0000-000000000000"}`;
    const mine = new Set(keywords.map(normalize));
    for (const o of others) {
      const overlapPosts = !o.post_ids.length || !post_ids.length || o.post_ids.some((x) => post_ids.includes(x));
      const clash = o.keywords.find((k) => mine.has(normalize(k)));
      if (clash && overlapPosts) errors.push(`A palavra ${clash} já está em uso na automação ativa "${o.name}".`);
    }
  }

  return {
    errors,
    data: {
      name, keywords, match_mode, post_ids, delivery_mode, default_lang, active, content,
      public_reply: p.public_reply !== false,
      pdf_url: p.pdf_url ?? null, pdf_name: p.pdf_name ?? null, pdf_size: p.pdf_size ?? null,
    },
  };
}

export async function uniqueSlug(base: string, currentId?: string): Promise<string> {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const s = i ? `${root}-${i + 1}` : root;
    const rows = await q`select 1 from automations where slug = ${s} and id <> ${currentId ?? "00000000-0000-0000-0000-000000000000"}`;
    if (!rows.length) return s;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function getAutomation(id: string): Promise<Automation | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await q<Automation>`select * from automations where id = ${id}`;
  return rows[0] ?? null;
}
