import Link from "next/link";
import Nav from "@/components/Nav";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-mark">BRACERUM PARK</span>
          <span className="brand-sub">Central Instagram</span>
        </Link>
        <Nav />
      </header>
      <main className="main">{children}</main>
      <footer className="foot">
        <span>Bracerum Park · PY-19, km 35 · Villeta, Paraguai</span>
        <span>Uso interno</span>
      </footer>
    </div>
  );
}
