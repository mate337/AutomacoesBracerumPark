import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const expected = process.env.ADMIN_PASSWORD ?? "";
  const target = new URL(next.startsWith("/") ? next : "/", req.url);

  if (!expected || !safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 600));
    const back = new URL("/login", req.url);
    back.searchParams.set("erro", "1");
    return NextResponse.redirect(back, 303);
  }
  const res = NextResponse.redirect(target, 303);
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
