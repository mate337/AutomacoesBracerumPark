// Executa db/schema.sql no banco apontado por DATABASE_URL.
// Uso: DATABASE_URL="postgres://..." npm run db:migrate
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL antes de executar.");
  process.exit(1);
}
const sql = neon(url);
const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .split(/;\s*$/m)
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

for (const st of statements) {
  await sql.query(st);
}
console.log(`Banco atualizado (${statements.length} instruções).`);
