import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// PGHOST starting with / is a Unix socket (typical for local peer-auth Postgres on Linux).
const socketHost = process.env.PGHOST?.startsWith("/") ? process.env.PGHOST : undefined;
const client = postgres(connectionString, socketHost ? { host: socketHost } : {});

export const db = drizzle(client, { schema });
