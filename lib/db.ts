import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { SCHEMA, TABLES } from "./schema";
import { databaseUrl } from "./env";

let client: NeonQueryFunction<false, false> | null = null;
let ready: Promise<void> | null = null;

export class SetupError extends Error {}

function sql() {
  if (!client) {
    const url = databaseUrl();
    if (!url) throw new SetupError("Banco de dados não conectado (variável DATABASE_URL ausente).");
    client = neon(url);
  }
  return client;
}

/** Cria as tabelas na primeira utilização. Idempotente. */
export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const s = sql();
      const [row] = (await s`select count(*)::int as n from pg_tables where schemaname = 'public' and tablename = any(${TABLES})`) as { n: number }[];
      if (row?.n === TABLES.length) return;
      for (const st of SCHEMA) await s.query(st);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

/** Consulta parametrizada: await q`select * from t where id = ${id}` */
export async function q<T = Record<string, any>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  await ensureSchema();
  return (await sql()(strings, ...values)) as T[];
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await q<{ value: string | null }>`select value from settings where key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await q`insert into settings (key, value, updated_at) values (${key}, ${value}, now())
          on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

export async function logEvent(level: "info" | "warn" | "error", message: string, detail?: unknown): Promise<void> {
  try {
    await q`insert into event_log (level, message, detail) values (${level}, ${message}, ${detail === undefined ? null : JSON.stringify(detail)}::jsonb)`;
  } catch (e) {
    console.error("[event_log]", message, detail, e);
  }
}
