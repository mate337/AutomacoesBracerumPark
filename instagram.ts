import { getSetting, setSetting } from "./db";

const VERSION = process.env.GRAPH_VERSION || "v25.0";
const BASE = `https://graph.instagram.com/${VERSION}`;

export class GraphError extends Error {
  code?: number;
  subcode?: number;
  constructor(message: string, raw?: any) {
    super(message);
    this.code = raw?.code;
    this.subcode = raw?.error_subcode;
  }
}

export async function getToken(): Promise<string> {
  const stored = await getSetting("ig_token");
  const token = stored || process.env.IG_ACCESS_TOKEN;
  if (!token) throw new GraphError("Token do Instagram não configurado. Acesse Configurações.");
  return token;
}

type CallOpts = { method?: "GET" | "POST" | "DELETE"; body?: unknown; params?: Record<string, string>; token?: string };

async function call<T = any>(path: string, opts: CallOpts = {}): Promise<T> {
  const token = opts.token ?? (await getToken());
  const url = new URL(path.startsWith("http") ? path : BASE + path);
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, v);
  if ((opts.method ?? "GET") === "GET") url.searchParams.set("access_token", token);

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new GraphError(data?.error?.message || `Erro ${res.status} na API do Instagram`, data?.error);
  }
  return data as T;
}

export type Account = { user_id: string; username: string; name?: string; profile_picture_url?: string; followers_count?: number; media_count?: number };

export async function getAccount(token?: string): Promise<Account> {
  return call<Account>("/me", { token, params: { fields: "user_id,username,name,profile_picture_url,followers_count,media_count" } });
}

export type Media = { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string; timestamp: string };

export async function listMedia(limit = 30): Promise<Media[]> {
  const data = await call<{ data: Media[] }>("/me/media", {
    params: { fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp", limit: String(limit) },
  });
  return data.data ?? [];
}

/** Resposta pública, no fio do comentário. */
export async function replyToComment(commentId: string, message: string) {
  return call(`/${commentId}/replies`, { method: "POST", body: { message } });
}

/** Resposta privada (Direct) vinculada a um comentário. Uma por comentário, até 7 dias. */
export async function sendPrivateReply(igId: string, commentId: string, message: Record<string, unknown>) {
  return call<{ recipient_id?: string; message_id: string }>(`/${igId}/messages`, {
    method: "POST",
    body: { recipient: { comment_id: commentId }, message },
  });
}

/** Mensagem comum no Direct, dentro da janela de 24 horas. */
export async function sendMessage(igId: string, recipientId: string, message: Record<string, unknown>) {
  return call<{ recipient_id: string; message_id: string }>(`/${igId}/messages`, {
    method: "POST",
    body: { recipient: { id: recipientId }, message },
  });
}

export async function getUserProfile(igsid: string): Promise<{ name?: string; username?: string }> {
  try {
    return await call(`/${igsid}`, { params: { fields: "name,username" } });
  } catch {
    return {};
  }
}

/** Renova o token de longa duração (60 dias). */
export async function refreshToken(): Promise<{ expiresAt: string }> {
  const token = await getToken();
  const data = await call<{ access_token: string; expires_in: number }>("https://graph.instagram.com/refresh_access_token", {
    token,
    params: { grant_type: "ig_refresh_token" },
  });
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await setSetting("ig_token", data.access_token);
  await setSetting("ig_token_expires_at", expiresAt);
  return { expiresAt };
}
