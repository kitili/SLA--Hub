import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const socketHost = process.env.PGHOST?.startsWith("/") ? process.env.PGHOST : undefined;
  const client = postgres(connectionString, socketHost ? { host: socketHost } : {});
  return drizzle(client, { schema });
}

const globalForDb = globalThis as { __dataTechDb?: ReturnType<typeof createDb> };

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    const real = (globalForDb.__dataTechDb ??= createDb()) as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
