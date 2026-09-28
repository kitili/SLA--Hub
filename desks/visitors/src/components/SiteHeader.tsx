"use client";

import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { campusPath } from "@/lib/campus-routes";
import type { CampusName } from "@/domain/Campus";

export function SiteHeader({
  title,
  subtitle,
  active,
  campus,
  extra,
}: {
  title: string;
  subtitle: string;
  active: "desk" | "history" | "qr" | "check-in";
  campus: string;
  extra?: React.ReactNode;
}) {
  const links = [
    { href: campusPath(campus as CampusName, "desk"), label: "Front desk", key: "desk" as const },
    { href: campusPath(campus as CampusName, "history"), label: "History", key: "history" as const },
    { href: campusPath(campus as CampusName, "qr"), label: "QR posters", key: "qr" as const },
  ];

  return (
    <header className="site-header">
      <Link href="/" className="brand-lockup">
        <BrandLogo variant="brandmark" height={44} priority />
        <div className="brand-copy">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </Link>
      <div className="nav-row">
        <div className="campus-badge" data-campus={campus}>
          {campus}
        </div>
        <nav className="view-toggle" aria-label="Visitor log views">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={active === link.key ? "active" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="ghost-btn hub-link">
          All campuses
        </Link>
        {extra}
      </div>
    </header>
  );
}
