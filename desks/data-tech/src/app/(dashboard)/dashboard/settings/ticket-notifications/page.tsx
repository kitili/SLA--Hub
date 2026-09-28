import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketNotifyRecipients } from "@/db/schema";
import { TicketNotifyRecipientsManager } from "@/components/settings/ticket-notify-recipients-manager";
import { hasModuleAccess } from "@/lib/modules";

export default async function TicketNotificationsPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";
  if (!isAdmin && !hasModuleAccess(session?.user.modules ?? {}, "ticket_notifications")) redirect("/dashboard");

  const canManage = isAdmin || hasModuleAccess(session!.user.modules, "ticket_notifications", "manage");
  const recipients = await db.select().from(ticketNotifyRecipients).orderBy(asc(ticketNotifyRecipients.email));
  return <TicketNotifyRecipientsManager recipients={recipients} canManage={canManage} />;
}
