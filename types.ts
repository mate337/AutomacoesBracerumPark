export type Lang = "pt" | "es";
export const LANGS: Lang[] = ["pt", "es"];

export type LangContent = {
  /** Respostas públicas ao comentário; uma é sorteada a cada envio. */
  publicReplies: string[];
  /** Primeira mensagem privada (modo "botão"). */
  opening: { text: string; button: string };
  /** Mensagem que acompanha o PDF (ou que carrega o link, no modo "direto"). */
  delivery: { text: string };
};

export type AutomationContent = Record<Lang, LangContent>;

export type DeliveryMode = "button" | "direct";
export type MatchMode = "contains" | "exact";

export type Automation = {
  id: string;
  name: string;
  slug: string;
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
  created_at: string;
  updated_at: string;
};

export type AutomationInput = Omit<Automation, "id" | "created_at" | "updated_at">;

export type DeliveryStatus = "received" | "awaiting" | "delivering" | "delivered" | "duplicate" | "failed";

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  received: "Recebido",
  awaiting: "Aguardando toque",
  delivering: "Enviando",
  delivered: "Material entregue",
  duplicate: "Já atendido",
  failed: "Falha no envio",
};
