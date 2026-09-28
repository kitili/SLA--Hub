"use client";

import { useEffect, useState } from "react";
import styles from "./admin.module.css";

type RoleOption = { role: string; count: number };

export function SheetStats() {
  const [roles, setRoles] = useState<RoleOption[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/hiring/sheet-import?roles=true")
      .then((r) => r.json())
      .then((d) => setRoles(d.roles ?? []))
      .catch(() => setError("Could not load sheet stats."))
      .finally(() => setLoading(false));
  }, []);

  const total = roles?.reduce((s, r) => s + r.count, 0) ?? 0;
  const max = roles ? Math.max(...roles.map((r) => r.count)) : 1;
  const sorted = roles ? [...roles].sort((a, b) => b.count - a.count) : [];

  return (
    <div className={styles.card} style={{ marginBottom: "1rem" }}>
      {/* Always-visible header row — click to expand/collapse */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          gap: "1rem",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--ink, #1e293b)" }}>
            Application form overview
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-muted, #64748b)" }}>
            {loading ? "Loading…" : error ? "Error loading data" : `${total} total applicants · ${sorted.length} positions`}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          {!loading && !error && (
            <div style={{
              background: "var(--electric-blue, #0b6bcb)",
              color: "#fff",
              borderRadius: 6,
              padding: "0.3rem 0.7rem",
              fontSize: "1rem",
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>
              {total}
            </div>
          )}
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              color: "var(--ink-muted, #64748b)",
            }}
          >
            <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Collapsible body */}
      {open && !loading && !error && roles && roles.length > 0 && (
        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border, #e2e8f0)", paddingTop: "0.85rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {sorted.map(({ role, count }) => {
              const pct = (count / max) * 100;
              return (
                <div key={role} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.18rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 500, lineHeight: 1.3 }}>{role}</span>
                    <div style={{ height: 5, borderRadius: 3, background: "var(--surface-2, #f1f5f9)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: 3,
                        background: pct === 100 ? "var(--electric-blue, #0b6bcb)" : pct >= 60 ? "#38bdf8" : "#94a3b8",
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "var(--ink, #1e293b)",
                    minWidth: 28,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {open && error && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#b91c1c" }}>{error}</p>
      )}
    </div>
  );
}
