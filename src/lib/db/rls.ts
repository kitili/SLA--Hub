import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type postgres from "postgres";

export type RlsContext = {
  staffId: string;
  isAdmin: boolean;
  hiringToken: string;
};

export const EMPTY_RLS_CONTEXT: RlsContext = {
  staffId: "",
  isAdmin: false,
  hiringToken: "",
};

const als = new AsyncLocalStorage<RlsContext>();

export function mergeRlsContext(
  base: RlsContext,
  patch: Partial<RlsContext>,
): RlsContext {
  return {
    staffId: patch.staffId ?? base.staffId,
    isAdmin: patch.isAdmin ?? base.isAdmin,
    hiringToken: patch.hiringToken ?? base.hiringToken,
  };
}

export function runWithRls<T>(patch: Partial<RlsContext>, fn: () => T): T {
  const current = als.getStore() ?? EMPTY_RLS_CONTEXT;
  return als.run(mergeRlsContext(current, patch), fn);
}

export function usesPublicDbRole(): boolean {
  return Boolean(process.env.DATABASE_PUBLIC_URL?.trim());
}

async function contextFromSessionCookie(): Promise<RlsContext> {
  try {
    const { cookies } = await import("next/headers");
    const { decodeSession, getSessionCookieName } = await import(
      "@/lib/auth/session-cookie"
    );
    const raw = (await cookies()).get(getSessionCookieName())?.value;
    if (!raw) return EMPTY_RLS_CONTEXT;
    const session = await decodeSession(raw);
    if (!session) return EMPTY_RLS_CONTEXT;
    return {
      staffId: session.staffId,
      isAdmin: session.isAdmin === true,
      hiringToken: "",
    };
  } catch {
    return EMPTY_RLS_CONTEXT;
  }
}

export async function resolveRlsContext(): Promise<RlsContext> {
  const fromAls = als.getStore();
  const fromCookie = await contextFromSessionCookie();
  if (!fromAls) return fromCookie;
  return mergeRlsContext(fromCookie, fromAls);
}

type Sql = ReturnType<typeof postgres>;

/**
 * Pin `app.current_staff_id` / `app.is_admin` / `app.hiring_token` on every
 * postgres-js query when `DATABASE_PUBLIC_URL` is set. SET LOCAL is applied
 * inside a transaction so pooled connections cannot leak another request's
 * GUC values.
 */
export function wrapSqlWithRls(sql: Sql): Sql {
  if (!usesPublicDbRole()) return sql;

  const origUnsafe = sql.unsafe.bind(sql);
  const origBegin = sql.begin.bind(sql) as Sql["begin"];

  async function applyGucs(tx: Sql): Promise<void> {
    const ctx = await resolveRlsContext();
    await tx`select set_config('app.current_staff_id', ${ctx.staffId}, true)`;
    await tx`select set_config('app.is_admin', ${ctx.isAdmin ? "true" : "false"}, true)`;
    await tx`select set_config('app.hiring_token', ${ctx.hiringToken}, true)`;
  }

  sql.begin = ((...args: unknown[]) => {
    const callback = (
      typeof args[0] === "function" ? args[0] : args[1]
    ) as (tx: Sql) => unknown;
    const options = typeof args[0] === "function" ? undefined : args[0];
    const wrapped = async (tx: Sql) => {
      await applyGucs(tx);
      return callback(tx);
    };
    return options
      ? origBegin(options as never, wrapped as never)
      : origBegin(wrapped as never);
  }) as Sql["begin"];

  sql.unsafe = ((query: string, params?: unknown, queryOptions?: unknown) => {
    const run = async (asValues: boolean) => {
      return origBegin(async (tx) => {
        await applyGucs(tx as unknown as Sql);
        const result = (tx as unknown as Sql).unsafe(
          query,
          params as never,
          queryOptions as never,
        );
        return asValues
          ? (result as { values: () => Promise<unknown> }).values()
          : result;
      });
    };
    // Lazy: drizzle either awaits the result or calls `.values()`, not both.
    // Starting the query in the constructor would double-execute `.values()`.
    const lazy = {
      then: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => run(false).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        run(false).catch(onRejected),
      finally: (onFinally?: () => void) => run(false).finally(onFinally),
      values: () => run(true),
    };
    return lazy;
  }) as Sql["unsafe"];

  return sql;
}
