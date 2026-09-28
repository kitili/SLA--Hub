import { eq } from "drizzle-orm";
import { db } from "@/db";
import { toolReminderDates, toolRemindersSent } from "@/db/schema";
import { REMINDER_OFFSET_DAYS, getTechToolsManagerEmails } from "@/lib/reminders";
import { sendEmail } from "@/lib/email/send-email";
import { toolReminderEmail } from "@/lib/email/templates/tool-reminder";

function daysUntil(dateStr: string, from: Date) {
  const target = new Date(`${dateStr}T00:00:00Z`);
  const fromMidnightUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((target.getTime() - fromMidnightUtc) / 86_400_000);
}

// Runs daily, mirroring sendSubscriptionReminders — same fixed offsets, same
// claim-before-send dedup via the unique index on tool_reminders_sent.
export async function sendToolReminders() {
  const today = new Date();

  const activeReminders = await db.query.toolReminderDates.findMany({
    where: eq(toolReminderDates.isActive, true),
    with: { tool: true },
  });

  const recipients = await getTechToolsManagerEmails();
  const offsets: readonly number[] = REMINDER_OFFSET_DAYS;

  let remindersSent = 0;

  for (const reminder of activeReminders) {
    const offset = daysUntil(reminder.date, today);
    if (!offsets.includes(offset)) continue;

    const claimed = await db
      .insert(toolRemindersSent)
      .values({ reminderDateId: reminder.id, date: reminder.date, offsetDays: offset })
      .onConflictDoNothing()
      .returning();
    if (claimed.length === 0) continue;

    if (recipients.length === 0) continue;

    const { subject, html } = toolReminderEmail({
      toolLabel: `${reminder.tool.assetTag} — ${reminder.tool.name}`,
      reminderLabel: reminder.label,
      date: reminder.date,
      daysUntil: offset,
      toolUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tools/${reminder.tool.id}`,
    });

    await sendEmail({ to: recipients, subject, html }).catch(() => {});
    remindersSent++;
  }

  return { remindersSent };
}
