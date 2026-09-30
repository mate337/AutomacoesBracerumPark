import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    client = neon(url);
  }
  return client;
}

/** Consulta parametrizada: await q`select * from t where id = ${id}` */
export async function q<T = Record<string, any>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
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
