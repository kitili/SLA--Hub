import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionDepartments, subscriptionNotifyRecipients } from "@/db/schema";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// undefined leaves the existing set untouched (e.g. a PATCH that doesn't mention it);
// an array (even empty) replaces the full set.
export async function applySubscriptionDepartments(executor: DbOrTx, subscriptionId: string, departmentIds?: string[]) {
  if (departmentIds === undefined) return;
  await executor.delete(subscriptionDepartments).where(eq(subscriptionDepartments.subscriptionId, subscriptionId));
  if (departmentIds.length > 0) {
    await executor.insert(subscriptionDepartments).values(departmentIds.map((departmentId) => ({ subscriptionId, departmentId })));
  }
}

export async function applySubscriptionRecipients(executor: DbOrTx, subscriptionId: string, emails?: string[]) {
  if (emails === undefined) return;
  await executor.delete(subscriptionNotifyRecipients).where(eq(subscriptionNotifyRecipients.subscriptionId, subscriptionId));
  const unique = Array.from(new Set(emails.map((e) => e.toLowerCase().trim()))).filter(Boolean);
  if (unique.length > 0) {
    await executor.insert(subscriptionNotifyRecipients).values(unique.map((email) => ({ subscriptionId, email })));
  }
}
