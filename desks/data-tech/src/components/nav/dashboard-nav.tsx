"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; match?: string };
export type NavGroup = { label: string; items: NavItem[] };

function isActive(pathname: string, item: NavItem) {
  const href = item.match ?? item.href;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 px-3 pb-4">
      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <div key={group.label}>
            <div className="px-3 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive(pathname, item)
                      ? "rounded-xl bg-white/10 px-3 py-2 text-sm text-white shadow-[inset_2px_0_0_#ffc952]"
                      : "rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/8 hover:text-white"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ),
      )}
    </nav>
  );
}
