"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { hubEntryHref, isExternalUrl, type Department } from "@/lib/departments";
import { LAST_DESK_KEY } from "@/lib/last-desk";
import { ArrowIcon, DepartmentIcon, SearchIcon } from "@/components/icons";
import styles from "./hub.module.css";

function matchesLastDesk(department: Department, lastHref: string | null) {
  if (!lastHref) return false;
  return (
    department.href === lastHref ||
    department.liveUrl === lastHref ||
    lastHref.startsWith(`${department.href}/`)
  );
}

export default function HubHome({
  firstName,
  departments,
}: {
  firstName?: string;
  departments: Department[];
}) {
  const [query, setQuery] = useState("");
  const [today, setToday] = useState("");
  const [lastHref, setLastHref] = useState<string | null>(null);

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat("en-TZ", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    );
    setLastHref(window.localStorage.getItem(LAST_DESK_KEY));
  }, []);

  const lastDesk = departments.find((department) => matchesLastDesk(department, lastHref));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return departments;
    return departments.filter((department) => {
      const haystack = [department.name, department.kicker, department.summary, ...department.desks]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [departments, query]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.heroKicker}>Silverleaf workplace</p>
        <h1 className={styles.heroTitle}>{firstName ? `Karibu, ${firstName}` : "Karibu"}</h1>
        <p className={styles.heroBody}>Choose a desk. One click opens that system.</p>
        <div className={styles.heroMeta}>
          <span>{today || "Tanzania"}</span>
          <span>Signed in on this device</span>
        </div>
      </section>

      {lastDesk ? (
        <DeskLink
          department={lastDesk}
          className={styles.continue}
          onOpen={() => window.localStorage.setItem(LAST_DESK_KEY, lastDesk.href)}
        >
          <DepartmentIcon id={lastDesk.id} className={styles.continueIcon} />
          <div>
            <strong>Continue</strong>
            <span>{lastDesk.name}</span>
          </div>
          <ArrowIcon className={styles.continueArrow} />
        </DeskLink>
      ) : null}

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <SearchIcon className={styles.searchIcon} />
          <span className={styles.srOnly}>Find a desk</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a desk…"
            autoComplete="off"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>No desk matches “{query}”.</p>
      ) : (
        <div className={styles.grid}>
          {filtered.map((department) => (
            <article key={department.id} className={styles.card} data-accent={department.accent}>
              <DeskLink
                department={department}
                className={styles.cardMain}
                onOpen={() => window.localStorage.setItem(LAST_DESK_KEY, department.href)}
              >
                <span className={styles.cardIcon}>
                  <DepartmentIcon id={department.id} />
                </span>
                <span className={styles.cardKicker}>{department.kicker}</span>
                <h2>{department.name}</h2>
                <p>{department.summary}</p>
                {department.hosted === false ? (
                  <span className={styles.cardLocal}>Local only · not hosted yet</span>
                ) : null}
                <span className={styles.cardOpen}>
                  Open <ArrowIcon />
                </span>
              </DeskLink>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function DeskLink({
  department,
  className,
  onOpen,
  children,
}: {
  department: Department;
  className: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  const href = hubEntryHref(department);
  if (isExternalUrl(href)) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer" onClick={onOpen}>
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href} onClick={onOpen}>
      {children}
    </Link>
  );
}
