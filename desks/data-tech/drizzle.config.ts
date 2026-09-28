import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const rawUrl = process.env.DATABASE_URL;
const socketHost = process.env.PGHOST?.startsWith("/") ? process.env.PGHOST : null;
const parsed = rawUrl.match(/^postgres(?:ql)?:\/\/(?:([^:@/]+)(?::[^@]*)?@)?(?:[^/]*)\/([^?]+)/);
const database = parsed?.[2];
const user = parsed?.[1] ? decodeURIComponent(parsed[1]) : undefined;

const dbCredentials = socketHost
  ? (() => {
      if (!database) throw new Error("DATABASE_URL must include a database name");
      return { host: socketHost, user, database };
    })()
  : { url: rawUrl };

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials,
});
