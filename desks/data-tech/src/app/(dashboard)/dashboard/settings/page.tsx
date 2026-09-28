import Link from "next/link";
import { requireLoginPage } from "@/lib/require-module-page";
import { hasModuleAccess, type ModuleKey } from "@/lib/modules";
import { Card } from "@/components/ui/card";

const LINKS: { href: string; title: string; body: string; module: ModuleKey }[] = [
  { href: "/dashboard/settings/users", title: "People", body: "Staff, roles, and who sits on which desk.", module: "users" },
  { href: "/dashboard/settings/departments", title: "Departments", body: "The desks: Onboarding, Uniforms, Marketing, Ops, and the rest.", module: "departments" },
  { href: "/dashboard/settings/support-contacts", title: "Support contacts", body: "Who the public ticket page points people to.", module: "support_contacts" },
  { href: "/dashboard/settings/ticket-notifications", title: "Ticket alerts", body: "Who gets emailed when a ticket is filed.", module: "ticket_notifications" },
  { href: "/dashboard/one-to-fives", title: "1–5 calendar", body: "Holidays, extra work days, and everyone’s 1–5s today.", module: "one_to_fives" },
];

export default async function SettingsHubPage() {
  const { session, isAdmin } = await requireLoginPage();
  const can = (module: ModuleKey) => isAdmin || hasModuleAccess(session.user.modules, module, "view");
  const visible = LINKS.filter((link) => can(link.module));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-xl font-medium text-navy">Settings</h1>
      <p className="mt-1 mb-6 text-sm text-black/55">Admin tools. Day-to-day work lives on Today and Team.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visible.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <h2 className="font-medium text-navy">{link.title}</h2>
              <p className="mt-1 text-sm text-black/55">{link.body}</p>
            </Card>
          </Link>
        ))}
        {visible.length === 0 && <p className="text-sm text-black/50">No admin tools on this account.</p>}
      </div>
    </div>
  );
}
