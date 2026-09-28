"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { brand } from "@/lib/brand";
import type { Role } from "@/lib/roles";

type NavLink = { href: string; label: string; badgeKey?: "incidents" | "alerts" };
type NavGroup = { label: string; href?: string; links: NavLink[] };

const NAV: NavGroup[] = [
  {
    label: "Dashboard",
    links: [{ href: "/admin/dashboard", label: "Transport overview" }],
  },
  {
    label: "Students",
    links: [
      { href: "/admin/students", label: "Students" },
      { href: "/admin/assignments", label: "Assignments" },
      { href: "/admin/boarding", label: "Scans" },
    ],
  },
  {
    label: "Buses",
    links: [
      { href: "/admin/buses", label: "Buses" },
      { href: "/admin/drivers", label: "Drivers" },
      { href: "/admin/routes", label: "Routes" },
      { href: "/admin/live", label: "Live" },
      { href: "/admin/trips", label: "Trips" },
      { href: "/admin/maintenance", label: "Repair & Maintenance" },
      { href: "/admin/incidents", label: "Incidents", badgeKey: "incidents" },
      { href: "/admin/alerts", label: "Alerts", badgeKey: "alerts" },
    ],
  },
  {
    label: "Money",
    links: [
      { href: "/admin/ledger", label: "Ledger" },
      { href: "/admin/hire-outs", label: "Hire-outs" },
    ],
  },
  { label: "Messages", href: "/admin/messages", links: [] },
];

const EXACT_MATCH_ONLY = new Set(["/admin/dashboard", "/admin/farm"]);

function isActive(pathname: string, href: string) {
  return EXACT_MATCH_ONLY.has(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: Role | null;
}) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const [badges, setBadges] = useState({ incidents: 0, alerts: 0 });
  const onFarmPath =
    pathname === "/admin/farm" || pathname.startsWith("/admin/farm/");
  const onFarmSurface =
    role === "farm" ||
    role === "ops_manager" ||
    (role !== "transport" && onFarmPath);
  const homeHref = onFarmSurface ? "/admin/farm" : "/admin/dashboard";

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  // Live dots on Buses → Incidents / Alerts when action is needed.
  useEffect(() => {
    if (onFarmSurface) return;
    let cancelled = false;
    async function loadBadges() {
      try {
        const [incRes, alertRes] = await Promise.all([
          fetch("/api/incidents?severity=high"),
          fetch("/api/incident-alerts?limit=50"),
        ]);
        const incData = (await incRes.json()) as { incidents?: { id: string }[] };
        const alertData = (await alertRes.json()) as {
          alerts?: { acknowledged_at: string | null }[];
        };
        if (cancelled) return;
        const highIncidents = incRes.ok ? (incData.incidents?.length ?? 0) : 0;
        const unacked = alertRes.ok
          ? (alertData.alerts ?? []).filter((a) => !a.acknowledged_at).length
          : 0;
        setBadges({ incidents: highIncidents, alerts: unacked });
      } catch {
        // leave badges at 0
      }
    }
    void loadBadges();
    const id = window.setInterval(() => void loadBadges(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [onFarmSurface, pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-card-border/80 bg-white/75 shadow-[var(--shadow)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href={homeHref}
            className="flex min-w-0 items-center gap-2 no-underline"
          >
            <Image
              src={brand.logos.logomarkElectricBlue}
              alt={brand.shortName}
              width={32}
              height={32}
              className="h-8 w-auto shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-light-blue">
                {onFarmSurface ? "Farm · Admin" : "Transport · Admin"}
              </p>
              <p className="truncate text-sm font-bold text-ink">
                {brand.productName}
              </p>
            </div>
          </Link>
          <nav
            ref={navRef}
            className="relative flex flex-wrap items-center gap-1"
          >
            {onFarmSurface ? (
              <>
                {role !== "farm" ? (
                  <Link
                    href="/ops"
                    className="rounded-full px-3.5 py-2 text-sm font-semibold text-electric-blue no-underline transition hover:bg-white/80"
                  >
                    Ops hub
                  </Link>
                ) : null}
                <Link
                  href="/admin/farm"
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold no-underline transition ${
                    isActive(pathname, "/admin/farm")
                      ? "bg-electric-blue text-white shadow-md shadow-electric-blue/25"
                      : "text-electric-blue hover:bg-white/80"
                  }`}
                >
                  Farm
                </Link>
              </>
            ) : (
              <>
                {role === "admin" ? (
                  <Link
                    href="/ops/admin"
                    className="rounded-full bg-gradient-to-r from-[#002368] to-electric-blue px-4 py-2 text-sm font-bold text-white no-underline shadow-md shadow-electric-blue/25 hover:brightness-110"
                  >
                    Admin
                  </Link>
                ) : null}
                <Link
                  href="/ops"
                  className="rounded-full px-3.5 py-2 text-sm font-semibold text-electric-blue no-underline transition hover:bg-white/80"
                >
                  Ops hub
                </Link>
                {NAV.map((group) => {
                  if (group.links.length === 0 && group.href) {
                    const active = isActive(pathname, group.href);
                    return (
                      <Link
                        key={group.label}
                        href={group.href}
                        className={`rounded-full px-3.5 py-2 text-sm font-semibold no-underline transition ${
                          active
                            ? "bg-electric-blue text-white shadow-md shadow-electric-blue/25"
                            : "text-electric-blue hover:bg-white/80"
                        }`}
                      >
                        {group.label}
                      </Link>
                    );
                  }

                  const groupActive = group.links.some((l) =>
                    isActive(pathname, l.href),
                  );
                  const isOpen = openGroup === group.label;
                  const groupHasBadge =
                    group.label === "Buses" &&
                    (badges.incidents > 0 || badges.alerts > 0);

                  return (
                    <div key={group.label} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenGroup(isOpen ? null : group.label)
                        }
                        className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                          groupActive
                            ? "bg-electric-blue text-white shadow-md shadow-electric-blue/25"
                            : "text-electric-blue hover:bg-white/80"
                        }`}
                        aria-expanded={isOpen}
                      >
                        {group.label}
                        {groupHasBadge ? (
                          <span
                            className="ml-0.5 inline-block h-2 w-2 rounded-full bg-danger"
                            aria-label="Open safety items"
                          />
                        ) : null}
                        <span
                          className={`text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}
                        >
                          ▾
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="absolute left-0 top-full z-30 mt-1 min-w-[12.5rem] rounded-[var(--radius)] border border-card-border bg-white p-1 shadow-lg">
                          {group.links.map((link) => {
                            const active = isActive(pathname, link.href);
                            const badge =
                              link.badgeKey === "incidents"
                                ? badges.incidents
                                : link.badgeKey === "alerts"
                                  ? badges.alerts
                                  : 0;
                            return (
                              <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold no-underline transition ${
                                  active
                                    ? "bg-electric-blue text-white"
                                    : "text-electric-blue hover:bg-light-blue-30"
                                }`}
                              >
                                <span>{link.label}</span>
                                {badge > 0 ? (
                                  <span
                                    className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                      active
                                        ? "bg-gold text-electric-blue"
                                        : "bg-danger text-white"
                                    }`}
                                  >
                                    {badge > 99 ? "99+" : badge}
                                  </span>
                                ) : null}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </>
            )}
            <LogoutButton />
          </nav>
        </div>
      </header>
      <div className="ui-rise mx-auto w-full max-w-6xl">{children}</div>
    </div>
  );
}
