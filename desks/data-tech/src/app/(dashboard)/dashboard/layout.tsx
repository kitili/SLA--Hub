import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { type ModuleKey } from "@/lib/modules";
import { DashboardNav, type NavGroup } from "@/components/nav/dashboard-nav";
import { Mark } from "@/components/brand/mark";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.error === "SessionRevoked") {
    redirect("/login");
  }

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const role = session.user.role;
  const isAdmin = role === "admin";
  const can = (module: ModuleKey) => isAdmin || Boolean(session.user.modules[module]);
  const teamHref = session.user.departmentId ? `/dashboard/desks/${session.user.departmentId}` : "/dashboard/desks";
  const showSettings =
    can("users") || can("departments") || can("support_contacts") || can("ticket_notifications");

  const groups: NavGroup[] = [
    {
      label: "Day",
      items: [
        { href: "/dashboard", label: "Today" },
        { href: teamHref, label: "Team", match: "/dashboard/desks" },
        { href: "/dashboard/snapshot", label: "Week" },
        { href: "/dashboard/workplace", label: "Everyone" },
      ],
    },
    {
      label: "Work",
      items: [
        ...(can("systems") ? [{ href: "/dashboard/systems", label: "Projects" }] : []),
        ...(can("tickets") ? [{ href: "/dashboard/tickets", label: "Tickets" }] : []),
        ...(can("tech_tools") ? [{ href: "/dashboard/tools", label: "Tools" }] : []),
      ],
    },
    {
      label: "Admin",
      items: showSettings ? [{ href: "/dashboard/settings", label: "Settings" }] : [],
    },
  ];

  return (
    <div className="flex min-h-full flex-1">
      <input type="checkbox" id="nav-toggle" className="peer hidden" />

      <label
        htmlFor="nav-toggle"
        aria-label="Toggle navigation"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-navy text-white shadow-[0_10px_24px_-12px_rgba(0,35,104,0.9)] md:hidden"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-0.5 w-5 bg-gold-accent" />
          <span className="block h-0.5 w-5 bg-white" />
          <span className="block h-0.5 w-5 bg-white" />
        </span>
      </label>

      <label htmlFor="nav-toggle" className="fixed inset-0 z-30 hidden bg-navy/50 backdrop-blur-sm peer-checked:block md:hidden" />

      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 -translate-x-full flex-col overflow-y-auto border-r border-white/10 bg-[linear-gradient(180deg,#001845_0%,#002368_55%,#001433_100%)] text-white shadow-[16px_0_40px_-28px_rgba(0,20,51,0.8)] transition-transform duration-200 peer-checked:translate-x-0 md:static md:flex-shrink-0 md:translate-x-0">
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <Mark tone="dark" />
          <div>
            <div className="text-sm font-medium tracking-tight">Silverleaf</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Data & Tech</div>
          </div>
        </div>
        <DashboardNav groups={groups} />
        <div className="mt-auto border-t border-white/10 px-5 py-4 text-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-accent shadow-[0_0_8px_#ffc952]" />
            <div className="min-w-0 truncate text-white/75">{session.user.name ?? session.user.email}</div>
          </div>
          <Link href="/dashboard/settings/profile" className="block text-white/60 transition hover:text-white">
            Profile
          </Link>
          <form action={logout} className="mt-1">
            <button type="submit" className="text-white/60 transition hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-4 pt-20 sm:p-8 md:pt-8">{children}</main>
    </div>
  );
}
