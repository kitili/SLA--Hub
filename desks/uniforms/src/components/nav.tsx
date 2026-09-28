"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import { BrandLogo } from "@/components/brand-logo";
import { brand } from "@/lib/brand";
import type { SessionUser } from "@/lib/auth";
import { homeFor, navFor } from "@/lib/roles";

function navClass(active: boolean) {
  return active
    ? "bg-electric-blue text-white shadow-md shadow-electric-blue/25"
    : "text-electric-blue hover:bg-light-blue-30";
}

export function StaffNav({ user }: { user: SessionUser }) {
  const path = usePathname();
  const items = navFor(user.role);
  return (
    <header className="no-print sticky top-0 z-20 border-b border-card-border/80 bg-white/80 shadow-[var(--shadow)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={homeFor(user.role)} className="flex min-w-0 items-center gap-2 no-underline">
          <BrandLogo variant="logomark" width={32} height={32} className="h-8 w-auto shrink-0" priority />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-light-blue">
              {brand.shortName}
            </p>
            <p className="truncate text-sm font-bold text-ink">{brand.productName}</p>
          </div>
        </Link>
        <nav className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const active = path === item.href || path.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold no-underline transition ${navClass(active)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="flex items-center gap-3 text-sm">
          <span className="hidden text-ink-muted sm:inline">
            {user.name}{user.role === "CEO" ? "" : ` · ${user.role.replace("_", " ")}`}
            {user.campusName ? ` · ${user.campusName}` : ""}
          </span>
          <button
            className="rounded-full border border-card-border bg-white px-3 py-1.5 text-sm font-semibold text-electric-blue hover:bg-light-blue-30"
            type="submit"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}

export function ParentNav({ user }: { user: SessionUser }) {
  return (
    <header className="no-print border-b border-card-border/80 bg-white/80 shadow-[var(--shadow)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/parent" className="flex items-center gap-2 no-underline">
          <BrandLogo variant="logomark" width={32} height={32} className="h-8 w-auto" priority />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-light-blue">
              {brand.shortName}
            </p>
            <p className="text-sm font-bold text-ink">Parent portal</p>
          </div>
        </Link>
        <form action={logoutAction} className="flex items-center gap-3 text-sm">
          <span className="hidden text-ink-muted sm:inline">{user.name}</span>
          <button
            className="rounded-full border border-card-border bg-white px-3 py-1.5 font-semibold text-electric-blue hover:bg-light-blue-30"
            type="submit"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
