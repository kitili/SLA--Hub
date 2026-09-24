"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  departments as defaultDepartments,
  hubEntryHref,
  isDepartmentPath,
  isExternalUrl,
  type Department,
} from "@/lib/departments";
import { noteDeskOpen } from "@/lib/access-client";
import { signOutAction } from "@/lib/actions/auth";
import BrandLogo from "@/components/BrandLogo";
import { ActivityIcon, CloseIcon, DepartmentIcon, MenuIcon } from "@/components/icons";
import styles from "./HubShell.module.css";

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default function HubShell({
  children,
  user,
  departments = defaultDepartments,
}: {
  children: React.ReactNode;
  user: { fullName: string; email: string; isAdmin?: boolean };
  departments?: Department[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    await signOutAction();
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className={styles.nav} aria-label="Departments">
      <Link href="/hub" data-active={pathname === "/hub"} aria-current={pathname === "/hub" ? "page" : undefined}>
        <DepartmentIcon id="home" />
        Hub home
      </Link>
      {user.isAdmin ? (
        <Link href="/activity" data-active={pathname === "/activity" || pathname.startsWith("/activity/")}>
          <ActivityIcon />
          Who entered
        </Link>
      ) : null}
      <p className={styles.sectionLabel}>Desks</p>
      {departments.map((department) => {
        const href = hubEntryHref(department);
        const active = isDepartmentPath(pathname, department);
        const label = (
          <>
            <DepartmentIcon id={department.id} />
            {department.name}
          </>
        );
        if (isExternalUrl(href)) {
          return (
            <a
              key={department.id}
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={() => noteDeskOpen(department.id)}
            >
              {label}
            </a>
          );
        }
        return (
          <Link
            key={department.id}
            href={href}
            data-active={active}
            aria-current={active ? "page" : undefined}
            onClick={() => noteDeskOpen(department.id)}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className={styles.account}>
      <div className={styles.who}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(user.fullName, user.email)}
        </span>
        <div>
          <p>{user.fullName || "Silverleaf staff"}</p>
          <span>{user.email}</span>
        </div>
      </div>
      <button type="button" className={styles.signOut} onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <Link href="/hub" className={styles.brand} aria-label="Silverleaf Academy workplace">
          <BrandLogo variant="tagline" width={252} height={64} priority />
        </Link>
        <p className={styles.kicker}>Workplace</p>
        {nav}
        {account}
      </aside>
      <div className={styles.main}>
        <header className={styles.top}>
          <Link href="/hub" aria-label="Silverleaf Academy workplace">
            <BrandLogo variant="tagline" width={196} height={50} />
          </Link>
          <button
            type="button"
            className={styles.menuBtn}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        </header>
        <div className={styles.drawer} data-open={menuOpen} inert={!menuOpen}>
          <button type="button" className={styles.backdrop} aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Workplace menu">
            <div className={styles.drawerHead}>
              <BrandLogo variant="tagline" width={196} height={50} />
              <button type="button" className={styles.closeBtn} aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            {nav}
            {account}
          </div>
        </div>
        <div id="main" className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}
