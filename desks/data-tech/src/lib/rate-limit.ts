import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitEvents } from "@/db/schema";

const CLEANUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  const windowStart = new Date(Date.now() - windowSeconds * 1000);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rateLimitEvents)
    .where(and(eq(rateLimitEvents.key, key), gte(rateLimitEvents.createdAt, windowStart)));

  if (count >= limit) {
    return { allowed: false as const };
  }

  await db.insert(rateLimitEvents).values({ key });

  // Opportunistic cleanup so the table doesn't grow unbounded without needing a cron job.
  if (Math.random() < 0.01) {
    void db.delete(rateLimitEvents).where(lt(rateLimitEvents.createdAt, new Date(Date.now() - CLEANUP_MAX_AGE_MS)));
  }

  return { allowed: true as const };
}
