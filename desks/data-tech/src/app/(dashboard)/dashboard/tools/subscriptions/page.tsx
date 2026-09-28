import { asc } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, departments } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { SubscriptionsManager } from "@/components/tools/subscriptions-manager";

export default async function SubscriptionsPage() {
  const { canManage } = await requireModulePage("tech_tools", "view");

  const [rows, depts] = await Promise.all([
    db.query.subscriptions.findMany({
      orderBy: asc(subscriptions.renewalDate),
      with: { departmentLinks: { with: { department: true } }, notifyRecipients: true },
    }),
    db.select().from(departments).orderBy(asc(departments.name)),
  ]);

  const subs = rows.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    url: s.url,
    renewalDate: s.renewalDate,
    isActive: s.isActive,
    departments: s.departmentLinks.map((l) => l.department),
    notifyEmails: s.notifyRecipients.map((r) => r.email),
  }));

  return <SubscriptionsManager subscriptions={subs} departments={depts} canManage={canManage} />;
}
