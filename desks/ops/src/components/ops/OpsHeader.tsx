"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/brand";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { canAccessOpsCommandCenter } from "@/lib/dashboard/overview-scopes";
import type { Role } from "@/lib/roles";

function navClass(active: boolean) {
  return active
    ? "bg-electric-blue text-white shadow-md shadow-electric-blue/25"
    : "text-electric-blue hover:bg-white/80";
}

export function OpsHeader({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const canCommandCenter = role != null && canAccessOpsCommandCenter(role);
  const commandCenterLabel =
    role === "admin" ? "Admin" : role === "finance" ? "KPIs" : "My KPIs";
  const onAdmin = pathname.startsWith("/ops/admin");
  const onHub = pathname === "/ops";

  return (
    <header className="sticky top-0 z-20 border-b border-card-border/80 bg-white/75 shadow-[var(--shadow)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/ops" className="flex min-w-0 items-center gap-2 no-underline">
          <Image
            src={brand.logos.logomarkElectricBlue}
            alt={brand.shortName}
            width={32}
            height={32}
            className="h-8 w-auto shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-light-blue">
              {brand.shortName} · Ops
            </p>
            <p className="truncate text-sm font-bold text-ink">{brand.productName}</p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/ops"
            className={`rounded-full px-3.5 py-2 text-sm font-semibold no-underline transition ${navClass(onHub)}`}
          >
            Dashboards
          </Link>

          {canCommandCenter ? (
            <Link
              href="/ops/admin"
              className={`rounded-full px-4 py-2 text-sm font-bold no-underline transition ${
                onAdmin
                  ? "bg-gradient-to-r from-[#001a4d] to-electric-blue text-white shadow-lg shadow-electric-blue/30"
                  : "bg-gradient-to-r from-[#002368] to-electric-blue text-white shadow-md shadow-electric-blue/25 hover:brightness-110"
              }`}
            >
              {commandCenterLabel}
            </Link>
          ) : null}

          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
