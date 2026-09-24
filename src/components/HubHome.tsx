"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { hubEntryHref, isExternalUrl, type Department } from "@/lib/departments";
import { noteDeskOpen } from "@/lib/access-client";
import { ArrowIcon, DepartmentIcon, ExternalIcon, SearchIcon } from "@/components/icons";
import styles from "./hub.module.css";

export default function HubHome({
  firstName,
  departments,
  isAdmin = false,
}: {
  firstName?: string;
  departments: Department[];
  isAdmin?: boolean;
  recentAccess?: Array<{
    id: string;
    name: string;
    email: string;
    action: string;
    part: string | null;
    at: string;
  }>;
}) {
  const [query, setQuery] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat("en-TZ", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    );
  }, []);

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
        <div className={styles.heroCopy}>
          <p className={styles.heroKicker}>Silverleaf workplace</p>
          <h1 className={styles.heroTitle}>{firstName ? `Karibu, ${firstName}` : "Karibu"}</h1>
          <p className={styles.heroBody}>{departments.length} desks. One click opens the live system.</p>
          <div className={styles.heroMeta}>
            <span>{today || "Tanzania"}</span>
            <span>Signed in</span>
            {isAdmin ? (
              <Link href="/activity" className={styles.heroLink}>
                Who entered
              </Link>
            ) : null}
          </div>
        </div>
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
      </section>

      {filtered.length === 0 ? (
        <p className={styles.empty}>No desk matches “{query}”.</p>
      ) : (
        <div id="desks" className={styles.grid}>
          {filtered.map((department) => (
            <article key={department.id} className={styles.card} data-accent={department.accent}>
              <DeskLink department={department} className={styles.cardMain}>
                <span className={styles.cardIcon}>
                  <DepartmentIcon id={department.id} />
                </span>
                <h2>{department.name}</h2>
                <p>{department.summary}</p>
                <ul className={styles.cardDesks}>
                  {department.desks.slice(0, 3).map((desk) => (
                    <li key={desk}>{desk}</li>
                  ))}
                </ul>
                <span className={styles.cardOpen}>
                  Open {isExternalUrl(hubEntryHref(department)) ? <ExternalIcon /> : <ArrowIcon />}
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
  children,
}: {
  department: Department;
  className: string;
  children: ReactNode;
}) {
  const href = hubEntryHref(department);
  function handleOpen() {
    noteDeskOpen(department.id);
  }
  if (isExternalUrl(href)) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer" onClick={handleOpen}>
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href} onClick={handleOpen}>
      {children}
    </Link>
  );
}
