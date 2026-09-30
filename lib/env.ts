/**
 * Localiza variáveis de ambiente mesmo quando a Vercel as cria com prefixo
 * (ex.: BLOB_DATABASE_URL, STORAGE_POSTGRES_URL), conforme o nome dado na conexão.
 */
function findByPattern(exact: string[], suffixes: string[], exclude: RegExp): string | undefined {
  for (const k of exact) if (process.env[k]) return process.env[k];
  const keys = Object.keys(process.env).sort();
  for (const suf of suffixes) {
    const key = keys.find((k) => k.endsWith(suf) && !exclude.test(k) && process.env[k]);
    if (key) return process.env[key];
  }
  return undefined;
}

export function databaseUrl(): string | undefined {
  return findByPattern(["DATABASE_URL", "POSTGRES_URL"], ["_DATABASE_URL", "_POSTGRES_URL"], /UNPOOLED|NO_SSL|PRISMA|NON_POOLING/);
}

export function blobMode(): "token" | "presigned" | "none" {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token";
  if (process.env.BLOB_STORE_ID) return "presigned";
  return "none";
}
