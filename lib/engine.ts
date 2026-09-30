import { q, getSetting, setSetting, logEvent } from "./db";
import {
  GraphError, replyToComment, sendPrivateReply, sendMessage, getUserProfile,
} from "./instagram";
import { matchesKeyword, detectLang, fillTemplate } from "./text";
import type { Automation, Lang } from "./types";

const PAYLOAD_PREFIX = "BP_DELIVER:";
const WINDOW_DAYS = 7;

function baseUrl() {
  return (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
}

export function trackedLink(slug: string, deliveryId?: string) {
  return `${baseUrl()}/m/${slug}${deliveryId ? `?d=${deliveryId}` : ""}`;
}

function pick<T>(list: T[]): T | undefined {
  return list.length ? list[Math.floor(Math.random() * list.length)] : undefined;
}

function langContent(a: Automation, lang: Lang) {
  return a.content[lang] ?? a.content[a.default_lang] ?? a.content.pt;
}

/** Divide a mensagem de entrega em "antes do link" e "depois do link". */
export function splitAtLink(text: string): [string, string] {
  const idx = text.search(/\{link\}/i);
  if (idx < 0) return [text, ""];
  return [text.slice(0, idx).trim(), text.slice(idx + "{link}".length).trim()];
}

// ─── Entrada ───────────────────────────────────────────────────────────

export async function processWebhook(body: any): Promise<void> {
  if (body?.object !== "instagram" || !Array.isArray(body.entry)) return;

  for (const entry of body.entry) {
    const ownId = String(entry.id ?? "");
    if (ownId && (await getSetting("ig_user_id")) !== ownId) await setSetting("ig_user_id", ownId);

    for (const change of entry.changes ?? []) {
      if (change.field === "comments" || change.field === "live_comments") {
        await safe("comentário", () => handleComment(ownId, change.value));
      }
    }
    for (const ev of entry.messaging ?? []) {
      await safe("mensagem", () => handleMessaging(ownId, ev));
    }
  }
}

async function safe(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    await logEvent("error", `Falha ao processar ${label}: ${e?.message ?? e}`);
  }
}

// ─── Comentários ───────────────────────────────────────────────────────

async function handleComment(ownId: string, v: any) {
  const commentId: string | undefined = v?.id;
  const fromId: string | undefined = v?.from?.id;
  const username: string | undefined = v?.from?.username;
  const text: string = v?.text ?? "";
  const mediaId: string | undefined = v?.media?.id;
  if (!commentId || !fromId || fromId === ownId) return;

  const ownUsername = await getSetting("ig_username");
  if (ownUsername && username && ownUsername.toLowerCase() === username.toLowerCase()) return;

  const automations = await q<Automation>`select * from automations where active = true order by created_at asc`;
  let automation: Automation | null = null;
  let keyword: string | null = null;
  for (const a of automations) {
    if (a.post_ids.length && (!mediaId || !a.post_ids.includes(mediaId))) continue;
    keyword = matchesKeyword(text, a.keywords, a.match_mode);
    if (keyword) { automation = a; break; }
  }
  if (!automation) return;

  const [contact] = await q<{ lang: Lang | null; full_name: string | null }>`
    insert into contacts (ig_user_id, username) values (${fromId}, ${username ?? null})
    on conflict (ig_user_id) do update set username = coalesce(excluded.username, contacts.username), last_seen = now()
    returning lang, full_name`;
  const lang = detectLang(text, contact?.lang ?? automation.default_lang);

  const inserted = await q<{ id: string }>`
    insert into deliveries (automation_id, comment_id, media_id, ig_user_id, username, comment_text, lang)
    values (${automation.id}, ${commentId}, ${mediaId ?? null}, ${fromId}, ${username ?? null}, ${text}, ${lang})
    on conflict (comment_id) do nothing returning id`;
  if (!inserted.length) return; // notificação repetida pela Meta
  const deliveryId = inserted[0].id;

  // Uma única entrega automática por pessoa e por material.
  const already = await q`select 1 from deliveries where ig_user_id = ${fromId} and automation_id = ${automation.id}
                          and status = 'delivered' and id <> ${deliveryId} limit 1`;
  if (already.length) {
    await q`update deliveries set status = 'duplicate' where id = ${deliveryId}`;
    return;
  }

  const c = langContent(automation, lang);
  const vars = { nome: contact?.full_name, usuario: username };

  if (automation.public_reply) {
    const reply = pick(c.publicReplies.filter((r) => r.trim()));
    if (reply) {
      try {
        await replyToComment(commentId, fillTemplate(reply, vars));
      } catch (e: any) {
        await logEvent("warn", `Resposta pública não publicada (${automation.name}): ${e.message}`, { commentId });
      }
    }
  }

  const igId = ownId || (await getSetting("ig_user_id")) || "";
  try {
    if (automation.delivery_mode === "direct") {
      const link = trackedLink(automation.slug, deliveryId);
      let body = fillTemplate(c.delivery.text, { ...vars, link });
      if (!/\{link\}/i.test(c.delivery.text)) body = `${body}\n${link}`;
      await sendPrivateReply(igId, commentId, { text: body.slice(0, 1000) });
      await q`update deliveries set status = 'delivered', opened_at = now(), delivered_at = now() where id = ${deliveryId}`;
    } else {
      await sendOpening(igId, commentId, deliveryId, fillTemplate(c.opening.text, vars), c.opening.button);
      await q`update deliveries set status = 'awaiting', opened_at = now() where id = ${deliveryId}`;
    }
  } catch (e: any) {
    await q`update deliveries set status = 'failed', error = ${e.message} where id = ${deliveryId}`;
    await logEvent("error", `Resposta privada não enviada (${automation.name}): ${e.message}`, { commentId, code: e.code });
  }
}

/** Mensagem de abertura com botão. Tenta o botão nativo; se a conta não aceitar, usa resposta rápida; por fim, texto. */
async function sendOpening(igId: string, commentId: string, deliveryId: string, text: string, button: string) {
  const payload = PAYLOAD_PREFIX + deliveryId;
  const title = button.slice(0, 20);
  const attempts: Record<string, unknown>[] = [
    { attachment: { type: "template", payload: { template_type: "button", text: text.slice(0, 640), buttons: [{ type: "postback", title, payload }] } } },
    { text: text.slice(0, 1000), quick_replies: [{ content_type: "text", title, payload }] },
    { text: `${text.replace(/\s*(Toque|Toca)[^.]*\.\s*$/i, "")}\n\n${/^Hola/i.test(text) ? "Responda este mensaje para recibirlo." : "Responda esta mensagem para receber."}`.slice(0, 1000) },
  ];
  let last: unknown;
  for (const message of attempts) {
    try {
      return await sendPrivateReply(igId, commentId, message);
    } catch (e) {
      last = e;
      // Erros que não dependem do formato (token, permissão, prazo) não justificam nova tentativa.
      if (e instanceof GraphError && (e.code === 190 || e.code === 10 || e.code === 200)) throw e;
    }
  }
  throw last;
}

// ─── Mensagens ─────────────────────────────────────────────────────────

async function handleMessaging(ownId: string, ev: any) {
  const senderId: string | undefined = ev?.sender?.id;
  const msg = ev?.message;

  if (msg?.is_echo) {
    const to = ev?.recipient?.id;
    if (to && msg.mid) {
      await q`insert into messages (ig_user_id, direction, body, mid) values (${to}, 'out', ${msg.text ?? null}, ${msg.mid})
              on conflict (mid) do nothing`;
    }
    return;
  }
  if (!senderId || senderId === ownId) return;

  const text: string | undefined = msg?.text;
  if (msg?.mid) {
    await q`insert into messages (ig_user_id, direction, body, mid) values (${senderId}, 'in', ${text ?? null}, ${msg.mid})
            on conflict (mid) do nothing`;
  }
  await q`insert into contacts (ig_user_id) values (${senderId})
          on conflict (ig_user_id) do update set last_seen = now()`;

  const payload: string | undefined = ev?.postback?.payload ?? msg?.quick_reply?.payload;
  let deliveryId: string | null = null;

  if (payload?.startsWith(PAYLOAD_PREFIX)) {
    deliveryId = payload.slice(PAYLOAD_PREFIX.length);
  } else {
    const byId = await q<{ id: string }>`select id from deliveries where ig_user_id = ${senderId} and status = 'awaiting'
      and created_at > now() - make_interval(days => ${WINDOW_DAYS}) order by created_at desc limit 1`;
    deliveryId = byId[0]?.id ?? null;
    if (!deliveryId) {
      const profile = await getUserProfile(senderId);
      if (profile.username) {
        const byUser = await q<{ id: string }>`select id from deliveries where lower(username) = lower(${profile.username})
          and status = 'awaiting' and created_at > now() - make_interval(days => ${WINDOW_DAYS})
          order by created_at desc limit 1`;
        deliveryId = byUser[0]?.id ?? null;
      }
    }
  }

  if (!deliveryId) {
    // Conversa comum: fica registrada para o time comercial, sem resposta automática.
    if (text) {
      await q`update contacts set lang = coalesce(lang, ${detectLang(text)}) where ig_user_id = ${senderId}`;
    }
    return;
  }
  await deliver(ownId, senderId, deliveryId);
}

async function deliver(ownId: string, recipientId: string, deliveryId: string) {
  // Reserva atômica: evita entrega em dobro se a Meta repetir o evento.
  const claimed = await q<{ id: string; automation_id: string; lang: Lang; username: string | null }>`
    update deliveries set status = 'delivering' where id = ${deliveryId} and status = 'awaiting'
    returning id, automation_id, lang, username`;
  if (!claimed.length) return;
  const d = claimed[0];

  const [automation] = await q<Automation>`select * from automations where id = ${d.automation_id}`;
  if (!automation) {
    await q`update deliveries set status = 'failed', error = 'Automação removida' where id = ${deliveryId}`;
    return;
  }

  const profile = await getUserProfile(recipientId);
  await q`update contacts set full_name = coalesce(${profile.name ?? null}, full_name),
          username = coalesce(${profile.username ?? null}, username), lang = coalesce(lang, ${d.lang})
          where ig_user_id = ${recipientId}`;

  const c = langContent(automation, d.lang);
  const vars = { nome: profile.name, usuario: profile.username ?? d.username };
  const link = trackedLink(automation.slug, deliveryId);
  const [before, after] = splitAtLink(c.delivery.text);
  const igId = ownId || (await getSetting("ig_user_id")) || "";

  try {
    if (before) await sendMessage(igId, recipientId, { text: fillTemplate(before, vars).slice(0, 1000) });

    let fileSent = false;
    if (automation.pdf_url) {
      try {
        await sendMessage(igId, recipientId, { attachment: { type: "file", payload: { url: automation.pdf_url } } });
        fileSent = true;
      } catch (e: any) {
        await logEvent("warn", `PDF não anexado (${automation.name}); enviado como link: ${e.message}`);
      }
    }
    if (!fileSent) await sendMessage(igId, recipientId, { text: link });

    if (after) await sendMessage(igId, recipientId, { text: fillTemplate(after, vars).slice(0, 1000) });

    await q`update deliveries set status = 'delivered', delivered_at = now(), ig_user_id = coalesce(ig_user_id, ${recipientId})
            where id = ${deliveryId}`;
  } catch (e: any) {
    await q`update deliveries set status = 'failed', error = ${e.message} where id = ${deliveryId}`;
    await logEvent("error", `Entrega não concluída (${automation.name}): ${e.message}`, { deliveryId });
  }
}
