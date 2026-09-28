import "server-only";

/**
 * usage.ts — record staff interactions with lesson plans.
 *
 * Append-only logging into `plan_usage_events`, the source of truth for
 * "recently used", "your next lessons", and popularity metrics. Writes are
 * best-effort: a logging failure must never break a page render, so every
 * insert is wrapped in try/catch and swallowed (with a server-side warning).
 */
import { db } from "@/lib/db";
import { planUsageEvents, type UsageEventType } from "@/lib/db/schema";

export type { UsageEventType };

/**
 * Append one usage event for `staffId` against `planId`.
 *
 * Never throws into the caller: on any DB error we log a warning and return so
 * the surrounding page/render continues. Defaults to an `"open"` event, which
 * is what a plan-detail view records.
 *
 * @param staffId    The acting staff UUID (CurrentUser.id).
 * @param planId     The lesson plan UUID.
 * @param eventType  view | open | download (default "open").
 */
export async function logUsage(
  staffId: string,
  planId: string,
  eventType: UsageEventType = "open",
): Promise<void> {
  try {
    await db.insert(planUsageEvents).values({
      staffId,
      planId,
      eventType,
    });
  } catch (error) {
    // Best-effort telemetry — swallow so a logging hiccup never 500s a page.
    console.warn("[usage] failed to log usage event", {
      staffId,
      planId,
      eventType,
      error,
    });
  }
}
