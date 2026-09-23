"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminNavLink from "@/components/AdminNavLink";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { getDepartment, hubEntryHref, resolveDepartment } from "@/lib/departments";
import styles from "./OnboardingBar.module.css";

export default function OnboardingBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const locale = pathname.startsWith("/sw") ? "sw" : "en";
  const home = `/${locale}`;
  const catalog = getDepartment("onboarding");
  const liveOnboarding = catalog ? hubEntryHref(resolveDepartment(catalog)) : "https://onboarding.silverleaf.co.tz";

  return (
    <div className={styles.bar}>
      <nav className={styles.nav} aria-label="Onboarding">
        <a href={liveOnboarding} target="_blank" rel="noreferrer">
          Dashboard
        </a>
        <Link href={`${home}/bio`} data-active={pathname.includes("/bio")}>
          Bio
        </Link>
        <Link href={`${home}/sign-off`} data-active={pathname.includes("/sign-off")}>
          Sign-off
        </Link>
        {isAdmin ? <AdminNavLink isAdmin /> : null}
      </nav>
      <div className={styles.tools}>
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </div>
  );
}
