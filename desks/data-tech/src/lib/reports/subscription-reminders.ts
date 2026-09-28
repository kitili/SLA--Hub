import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, subscriptionRemindersSent } from "@/db/schema";
import { REMINDER_OFFSET_DAYS, getTechToolsManagerEmails } from "@/lib/reminders";
import { sendEmail } from "@/lib/email/send-email";
import { subscriptionReminderEmail } from "@/lib/email/templates/subscription-reminder";

function daysUntil(dateStr: string, from: Date) {
  const target = new Date(`${dateStr}T00:00:00Z`);
  const fromMidnightUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((target.getTime() - fromMidnightUtc) / 86_400_000);
}

// Runs daily. For each active subscription whose renewal falls exactly on one of the
// REMINDER_OFFSET_DAYS marks, claims that (subscription, renewalDate, offset) slot via the
// unique index on subscription_reminders_sent before sending — the claim is what prevents a
// re-run (retry, manual trigger) from emailing the same reminder twice.
export async function sendSubscriptionReminders() {
  const today = new Date();

  const activeSubs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.isActive, true),
    with: { departmentLinks: { with: { department: true } }, notifyRecipients: true },
  });

  const fallbackEmails = await getTechToolsManagerEmails();
  const offsets: readonly number[] = REMINDER_OFFSET_DAYS;

  let remindersSent = 0;

  for (const sub of activeSubs) {
    const offset = daysUntil(sub.renewalDate, today);
    if (!offsets.includes(offset)) continue;

    const claimed = await db
      .insert(subscriptionRemindersSent)
      .values({ subscriptionId: sub.id, renewalDate: sub.renewalDate, offsetDays: offset })
      .onConflictDoNothing()
      .returning();
    if (claimed.length === 0) continue;

    const recipients = sub.notifyRecipients.length > 0 ? sub.notifyRecipients.map((r) => r.email) : fallbackEmails;
    if (recipients.length === 0) continue;

    const { subject, html } = subscriptionReminderEmail({
      name: sub.name,
      description: sub.description,
      renewalDate: sub.renewalDate,
      daysUntil: offset,
      departments: sub.departmentLinks.map((l) => l.department.name),
      manageUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tools/subscriptions`,
    });

    await sendEmail({ to: recipients, subject, html }).catch(() => {});
    remindersSent++;
  }

  return { remindersSent };
}
