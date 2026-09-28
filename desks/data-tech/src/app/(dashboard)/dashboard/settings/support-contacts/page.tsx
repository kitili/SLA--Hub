import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { supportContacts } from "@/db/schema";
import { SupportContactsManager } from "@/components/settings/support-contacts-manager";
import { hasModuleAccess } from "@/lib/modules";

export default async function SupportContactsPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";
  if (!isAdmin && !hasModuleAccess(session?.user.modules ?? {}, "support_contacts")) redirect("/dashboard");

  const canManage = isAdmin || hasModuleAccess(session!.user.modules, "support_contacts", "manage");
  const contacts = await db.select().from(supportContacts).orderBy(asc(supportContacts.sortOrder));
  return <SupportContactsManager contacts={contacts} canManage={canManage} />;
}
