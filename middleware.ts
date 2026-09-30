import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "./lib/auth";

// Rotas públicas: login, webhook da Meta, rotina agendada, links de material e callback do upload.
const PUBLIC = [/^\/login/, /^\/api\/auth\//, /^\/api\/webhooks\//, /^\/api\/cron\//, /^\/m\//, /^\/api\/upload/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/|favicon|icon|robots).*)"] };
