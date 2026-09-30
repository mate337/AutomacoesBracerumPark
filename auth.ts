export const SESSION_COOKIE = "bp_session";

/** Token de sessão derivado do segredo; funciona no Edge e no Node. */
export async function sessionToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado.");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("bracerum-admin-v1:" + (process.env.ADMIN_PASSWORD || "")));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function isValidSession(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  try {
    return safeEqual(value, await sessionToken());
  } catch {
    return false;
  }
}
