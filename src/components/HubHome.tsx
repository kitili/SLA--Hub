"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { hubEntryHref, isExternalUrl, type Department } from "@/lib/departments";
import { LAST_DESK_KEY } from "@/lib/last-desk";
import { accessActionLabel, formatAccessWhen } from "@/lib/access-copy";
import { ArrowIcon, DepartmentIcon, ExternalIcon, SearchIcon } from "@/components/icons";
import styles from "./hub.module.css";

const PAGE_SIZE = 6;

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
  isAdmin = false,
  recentAccess = [],
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
  const [page, setPage] = useState(1);
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function goToPage(next: number) {
    setPage(next);
    document.getElementById("desks")?.scrollIntoView({ block: "start" });
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.heroKicker}>Silverleaf workplace</p>
        <h1 className={styles.heroTitle}>{firstName ? `Karibu, ${firstName}` : "Karibu"}</h1>
        <p className={styles.heroBody}>
          {departments.length} desks. One click opens the live system.
        </p>
        <div className={styles.heroMeta}>
          <span>{today || "Tanzania"}</span>
          <span>Signed in on this device</span>
          {isAdmin ? (
            <Link href="/activity" className={styles.heroLink}>
              Who entered
            </Link>
          ) : null}
        </div>
      </section>

      {lastDesk ? (
        <DeskLink
          department={lastDesk}
          className={styles.continue}
          onOpen={() => window.localStorage.setItem(LAST_DESK_KEY, hubEntryHref(lastDesk))}
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
        <p className={styles.count}>
          {filtered.length === departments.length
            ? `${departments.length} desks`
            : `${filtered.length} of ${departments.length}`}
        </p>
        <label className={styles.search}>
          <SearchIcon className={styles.searchIcon} />
          <span className={styles.srOnly}>Find a desk</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Find a desk…"
            autoComplete="off"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>No desk matches “{query}”.</p>
      ) : (
        <div id="desks" className={styles.grid}>
          {visible.map((department) => (
            <article key={department.id} className={styles.card} data-accent={department.accent}>
              <DeskLink
                department={department}
                className={styles.cardMain}
                onOpen={() => window.localStorage.setItem(LAST_DESK_KEY, hubEntryHref(department))}
              >
                <span className={styles.cardIcon}>
                  <DepartmentIcon id={department.id} />
                </span>
                <span className={styles.cardKicker}>{department.kicker}</span>
                <h2>{department.name}</h2>
                <p>{department.summary}</p>
                <ul className={styles.cardDesks}>
                  {department.desks.slice(0, 4).map((desk) => (
                    <li key={desk}>{desk}</li>
                  ))}
                </ul>
                {department.hosted === false ? (
                  <span className={styles.cardLocal}>Local only · not hosted yet</span>
                ) : null}
                <span className={styles.cardOpen}>
                  Open {isExternalUrl(hubEntryHref(department)) ? <ExternalIcon /> : <ArrowIcon />}
                </span>
              </DeskLink>
            </article>
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav className={styles.pager} aria-label="Desk pages">
          <button type="button" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>
            Previous
          </button>
          {Array.from({ length: pageCount }, (_, index) => {
            const number = index + 1;
            return (
              <button
                key={number}
                type="button"
                data-active={number === currentPage}
                aria-current={number === currentPage ? "page" : undefined}
                onClick={() => goToPage(number)}
              >
                {number}
              </button>
            );
          })}
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}

      {isAdmin && recentAccess.length > 0 ? (
        <section className={styles.activity}>
          <div className={styles.activityHead}>
            <h2>Who just entered</h2>
            <Link href="/activity">Full log</Link>
          </div>
          <ul>
            {recentAccess.map((event) => (
              <li key={event.id}>
                <strong>{event.name || event.email}</strong>
                <span>
                  {accessActionLabel(event.action)}
                  {event.part ? ` · ${event.part}` : ""}
                </span>
                <em>{formatAccessWhen(event.at)}</em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
