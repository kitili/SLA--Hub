"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveTrip } from "@/components/matron/ActiveTripChip";

type Tab = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: React.ReactNode;
};

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconScan() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4H5a1 1 0 0 0-1 1v2M17 4h2a1 1 0 0 1 1 1v2M7 20H5a1 1 0 0 1-1-1v-2M17 20h2a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <rect
        x="8"
        y="8"
        width="8"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function IconRoster() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M16 8h4M16 12h4M16 16h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPath() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h10M4 18h16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="18" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconReport() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4 21 19H3L12 4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4M12 16.5v.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Matron field app: Home · Scan · Path · Roster · Report */
export function MatronNav() {
  const pathname = usePathname();
  const trip = useActiveTrip();

  const scanHref = trip?.tripId
    ? `/matron/scan?tripId=${trip.tripId}`
    : "/matron";
  const pathHref = trip?.tripId
    ? `/matron/path?tripId=${trip.tripId}`
    : "/matron";
  const rosterHref = trip?.busId
    ? `/matron/students?busId=${trip.busId}`
    : "/matron/students";

  const tabs: Tab[] = [
    {
      href: "/matron",
      label: "Home",
      match: (p) => p === "/matron",
      icon: <IconHome />,
    },
    {
      href: scanHref,
      label: "Scan",
      match: (p) => p.startsWith("/matron/scan"),
      icon: <IconScan />,
    },
    {
      href: pathHref,
      label: "Path",
      match: (p) => p.startsWith("/matron/path"),
      icon: <IconPath />,
    },
    {
      href: rosterHref,
      label: "Roster",
      match: (p) => p.startsWith("/matron/students"),
      icon: <IconRoster />,
    },
    {
      href: "/matron/incidents",
      label: "Report",
      match: (p) => p.startsWith("/matron/incidents"),
      icon: <IconReport />,
    },
  ];

  return (
    <nav
      className="print:hidden fixed inset-x-0 bottom-0 z-30 border-t border-card-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="Matron app"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 pt-1.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 no-underline transition ${
                  active
                    ? "bg-electric-blue text-white"
                    : "text-ink-muted hover:bg-light-blue-30/60 hover:text-electric-blue"
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-semibold tracking-wide">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
