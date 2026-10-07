import "server-only";

import postgres from "postgres";

/**
 * The family register lives on the Ops database (`public.parents`), which is
 * not the hub's own Neon database. Prefer `OPS_DATABASE_URL`. Fall back to the
 * owner `DATABASE_URL` (never `DATABASE_PUBLIC_URL`, whose role cannot see
 * those rows).
 *
 * Supabase's session pooler (port 5432) rejects extra serverless clients, so
 * on Vercel that host is switched to the transaction pooler (port 6543).
 */
function familyDatabaseUrl(): string | null {
  const raw = process.env.OPS_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  if (!raw) return null;
  if (process.env.VERCEL && raw.includes(".pooler.supabase.com:5432")) {
    return raw.replace(".pooler.supabase.com:5432", ".pooler.supabase.com:6543");
  }
  return raw;
}

const globalForFamily = globalThis as unknown as {
  __slaFamilySql__?: ReturnType<typeof postgres>;
};

export function getFamilySql() {
  if (globalForFamily.__slaFamilySql__) return globalForFamily.__slaFamilySql__;
  const url = familyDatabaseUrl();
  if (!url) return null;
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10 });
  globalForFamily.__slaFamilySql__ = sql;
  return sql;
}

export function familyRegisterError(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://…").slice(0, 300);
}
