"use client";

import { useMemo, useState, useCallback } from "react";
import { useFormatter, useTranslations } from "next-intl";

import type { RiskLevel } from "@/lib/at-risk";
import { Link } from "@/i18n/navigation";
import styles from "./admin.module.css";
import RiskBadge from "./RiskBadge";

/** A monitoring row, serialized for the client (dates as ISO strings). */
export interface MemberTableRow {
  id: string;
  fullName: string;
  email: string;
  campus: string | null;
  completionPct: number;
  /** ISO string or null. */
  lastActiveAt: string | null;
  /** ISO string or null. */
  startedAt: string | null;
  complete: boolean;
  checkpointsPassed: number;
  /** Whether the member has a saved bio profile (enables PDF download). */
  hasBio: boolean;
  risk: RiskLevel;
}

type SortKey =
  | "fullName"
  | "email"
  | "completionPct"
  | "lastActiveAt"
  | "startedAt"
  | "risk";

type SortDir = "asc" | "desc";

const RISK_ORDER: Record<RiskLevel, number> = { green: 0, orange: 1, red: 2 };

export default function MembersTable({
  rows,
  campuses = [],
}: {
  rows: MemberTableRow[];
  campuses?: string[];
}) {
  const t = useTranslations("admin.members");
  const format = useFormatter();

  const [sortKey, setSortKey] = useState<SortKey>("lastActiveAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [campusFilter, setCampusFilter] = useState<string>("");
  // memberId → "idle" | "sending" | "sent" | "error"
  const [reminderState, setReminderState] = useState<Record<string, "sending" | "sent" | "error">>({});

  const sendReminder = useCallback(async (memberId: string) => {
    setReminderState((prev) => ({ ...prev, [memberId]: "sending" }));
    try {
      const res = await fetch(`/api/admin/members/${memberId}/reminder`, { method: "POST" });
      setReminderState((prev) => ({ ...prev, [memberId]: res.ok ? "sent" : "error" }));
      if (res.ok) setTimeout(() => setReminderState((prev) => { const next = { ...prev }; delete next[memberId]; return next; }), 3000);
    } catch {
      setReminderState((prev) => ({ ...prev, [memberId]: "error" }));
    }
  }, []);

  const UNASSIGNED = "__unassigned__";

  // All campuses from the master list, plus any legacy values already on members.
  const campusOptions = useMemo(() => {
    const seen = new Set<string>(campuses);
    for (const r of rows) {
      if (r.campus) seen.add(r.campus);
    }
    return Array.from(seen).sort();
  }, [rows, campuses]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "fullName" || key === "email" ? "asc" : "desc");
    }
  }

  const visible = useMemo(() => {
    let filtered = atRiskOnly ? rows.filter((r) => r.risk !== "green") : rows.slice();
    if (campusFilter) {
      filtered =
        campusFilter === UNASSIGNED
          ? filtered.filter((r) => !r.campus)
          : filtered.filter((r) => r.campus === campusFilter);
    }

    const dir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "fullName":
          cmp = a.fullName.localeCompare(b.fullName);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "completionPct":
          cmp = a.completionPct - b.completionPct;
          break;
        case "risk":
          cmp = RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
          break;
        case "lastActiveAt":
          cmp = dateCmp(a.lastActiveAt, b.lastActiveAt);
          break;
        case "startedAt":
          cmp = dateCmp(a.startedAt, b.startedAt);
          break;
      }
      return cmp * dir;
    });
    return filtered;
  }, [rows, atRiskOnly, campusFilter, sortKey, sortDir]);

  function header(key: SortKey, label: string) {
    const active = sortKey === key;
    return (
      <th
        className={styles.sortable}
        onClick={() => toggleSort(key)}
        scope="col"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        {active && (
          <span className={styles.sortArrow} aria-hidden="true">
            {sortDir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </th>
    );
  }

  function statusBadge(row: MemberTableRow) {
    if (row.complete) {
      return (
        <span className={`${styles.badge} ${styles.statusDone}`}>
          <span className={styles.badgeIcon} aria-hidden="true">
            ✓
          </span>
          {t("status.complete")}
        </span>
      );
    }
    if (!row.startedAt && row.checkpointsPassed === 0) {
      return (
        <span className={`${styles.badge} ${styles.statusNotStarted}`}>
          {t("status.notStarted")}
        </span>
      );
    }
    return (
      <span className={`${styles.badge} ${styles.statusProgress}`}>
        {t("status.inProgress")}
      </span>
    );
  }

  function formatDate(iso: string | null): string {
    if (!iso) return t("never");
    return format.dateTime(new Date(iso), { dateStyle: "medium" });
  }

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={atRiskOnly}
            onChange={(e) => setAtRiskOnly(e.target.checked)}
          />
          {t("filter.atRiskOnly")}
        </label>
        {campusOptions.length > 0 && (
          <select
            className={styles.select}
            style={{ width: "auto", minWidth: "160px" }}
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            aria-label={t("filter.campus")}
          >
            <option value="">{t("filter.campusAll")}</option>
            <option value={UNASSIGNED}>{t("filter.unassigned")}</option>
            {campusOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <span className={styles.muted}>{t("sortHint")}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {header("fullName", t("table.name"))}
              {header("email", t("table.email"))}
              <th scope="col">Campus</th>
              {header("completionPct", t("table.completion"))}
              {header("lastActiveAt", t("table.lastLogin"))}
              {header("startedAt", t("table.startDate"))}
              <th scope="col">{t("table.status")}</th>
              {header("risk", t("table.risk"))}
              <th scope="col">{t("table.bio")}</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className={styles.emptyRow} colSpan={10}>
                  {t("empty")}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id}>
                  <td className={styles.nameCell}>
                    <Link
                      href={`/admin/members/${row.id}`}
                      className={styles.memberLink}
                    >
                      {row.fullName || "—"}
                    </Link>
                  </td>
                  <td className={styles.muted}>{row.email}</td>
                  <td className={styles.muted}>{row.campus ?? "—"}</td>
                  <td className={styles.progressCell}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${row.completionPct}%` }}
                      />
                    </div>
                    <span className={styles.progressLabel}>
                      {row.completionPct}%
                    </span>
                  </td>
                  <td className={styles.muted}>{formatDate(row.lastActiveAt)}</td>
                  <td className={styles.muted}>{formatDate(row.startedAt)}</td>
                  <td>{statusBadge(row)}</td>
                  <td>
                    <RiskBadge level={row.risk} />
                  </td>
                  <td>
                    {row.hasBio ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                        <span className={styles.badge} style={{ background: "#d1fae5", color: "#065f46" }}>
                          ✓ Filled
                        </span>
                        <a
                          className={styles.bioDownload}
                          href={`/api/admin/members/${row.id}/bio-pdf`}
                          title={t("downloadBio")}
                          style={{ fontSize: "0.78rem" }}
                        >
                          ↓ PDF
                        </a>
                      </div>
                    ) : (
                      <span className={styles.badge} style={{ background: "#fef3c7", color: "#92400e" }}>
                        Not filled
                      </span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const state = reminderState[row.id];
                      if (state === "sent") {
                        return <span className={styles.badge} style={{ background: "#d1fae5", color: "#065f46" }}>Sent ✓</span>;
                      }
                      if (state === "error") {
                        return <span className={styles.badge} style={{ background: "#fee2e2", color: "#991b1b" }}>Failed</span>;
                      }
                      return (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSmall} ${styles.btnSecondary}`}
                          disabled={state === "sending"}
                          onClick={() => sendReminder(row.id)}
                        >
                          {state === "sending" ? "Sending…" : "Reminder"}
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function dateCmp(a: string | null, b: string | null): number {
  const av = a ? new Date(a).getTime() : -Infinity;
  const bv = b ? new Date(b).getTime() : -Infinity;
  return av - bv;
}
