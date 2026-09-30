// Funções puras: normalização, palavras-chave e detecção de idioma.
// Sem dependências, para rodar tanto no servidor quanto nos testes.

export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseKeywords(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[,;\n]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of list) {
    const clean = k.trim();
    const key = normalize(clean);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(clean.toUpperCase());
    }
  }
  return out;
}

/**
 * Verifica se o comentário aciona alguma das palavras-chave.
 * - exact: o comentário inteiro é a palavra (ignora acento, caixa, pontuação e emojis).
 * - contains: a palavra aparece como termo isolado dentro do comentário.
 */
export function matchesKeyword(
  comment: string,
  keywords: string[],
  mode: "contains" | "exact",
): string | null {
  const text = normalize(comment);
  if (!text) return null;
  for (const kw of keywords) {
    const k = normalize(kw);
    if (!k) continue;
    if (mode === "exact") {
      if (text === k) return kw;
    } else if ((" " + text + " ").includes(" " + k + " ")) {
      return kw;
    }
  }
  return null;
}

const PT_WORDS = [
  "quero", "queria", "obrigado", "obrigada", "voce", "voces", "nao", "sim", "gostaria",
  "tenho", "estou", "muito", "legal", "manda", "envia", "mande", "informacao", "informacoes",
  "tambem", "entao", "agora", "bom", "boa", "valeu", "top", "show", "oi", "ola", "pra", "vcs", "vc",
  "sou", "empresa", "fabrica", "caminhao", "meu", "minha", "isso", "aqui", "mais",
];
const ES_WORDS = [
  "quiero", "quisiera", "gracias", "usted", "ustedes", "hola", "tengo", "estoy", "muy",
  "bueno", "buena", "envieme", "enviame", "manden", "mandame", "informacion", "tambien", "entonces",
  "ahora", "soy", "fabrica", "camion", "mi", "eso", "aqui", "mas", "porfa", "saludos", "buenas",
  "donde", "cuanto", "cuando", "necesito", "puedo", "precio",
];
const PT_ONLY = new Set(PT_WORDS.filter((w) => !ES_WORDS.includes(w)));
const ES_ONLY = new Set(ES_WORDS.filter((w) => !PT_WORDS.includes(w)));

/**
 * Detecta português ou espanhol em textos curtos (comentários e mensagens).
 * Quando não há sinal suficiente, devolve o idioma de reserva.
 */
export function detectLang(text: string, fallback: "pt" | "es" = "pt"): "pt" | "es" {
  if (!text) return fallback;
  let pt = 0;
  let es = 0;
  const raw = text.toLowerCase();

  // Sinais ortográficos exclusivos
  if (/[ñ¿¡]/.test(raw)) es += 3;
  if (/[ãõç]/.test(raw)) pt += 3;
  if (/ções|ção|ões|ão\b/.test(raw)) pt += 2;
  if (/ción|ciones/.test(raw)) es += 2;
  if (/\bnh|lh/.test(normalize(raw)) || /nh|lh/.test(raw)) pt += 1;
  if (/\bll/.test(raw) || /ll[aeiou]/.test(raw)) es += 1;

  for (const w of normalize(raw).split(" ")) {
    if (PT_ONLY.has(w)) pt += 2;
    if (ES_ONLY.has(w)) es += 2;
  }
  if (pt === es) return fallback;
  return pt > es ? "pt" : "es";
}

/** Substitui {nome} e {usuario} pelos dados do contato. */
export function fillTemplate(template: string, vars: { nome?: string | null; usuario?: string | null; link?: string | null }): string {
  const nome = (vars.nome || "").trim().split(/\s+/)[0] || (vars.usuario ? `@${vars.usuario}` : "");
  return template
    .replace(/\{nome\}/gi, nome)
    .replace(/\{usuario\}/gi, vars.usuario ? `@${vars.usuario}` : "")
    .replace(/\{link\}/gi, vars.link || "")
    .replace(/Olá, \./g, "Olá.")
    .replace(/Hola, \./g, "Hola.")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function slugify(input: string): string {
  return normalize(input).replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 48) || "material";
}
