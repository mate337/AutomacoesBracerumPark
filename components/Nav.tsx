"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Automações", match: (p: string) => p === "/" || p.startsWith("/automacoes") },
  { href: "/atividade", label: "Atividade", match: (p: string) => p.startsWith("/atividade") },
  { href: "/configuracoes", label: "Configurações", match: (p: string) => p.startsWith("/configuracoes") },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={l.match(path) ? "is-active" : ""}>{l.label}</Link>
      ))}
      <form method="post" action="/api/auth/logout">
        <button type="submit">Sair</button>
      </form>
    </nav>
  );
}
