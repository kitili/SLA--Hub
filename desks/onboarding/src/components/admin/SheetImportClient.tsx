"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import styles from "./admin.module.css";

type SheetCandidate = {
  rowIndex: number;
  email: string;
  fullName: string;
  roleApplied: string;
  whatsapp: string;
  linkedin: string;
  cvLink: string;
  location: string;
  timestamp: string;
  alreadyImported: boolean;
};

type FilterMode = "position" | "email";

export function SheetImportClient() {
  const router = useRouter();
  const [mode, setMode] = useState<FilterMode>("position");

  const [positionQuery, setPositionQuery] = useState("");
  const [emailQuery, setEmailQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SheetCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; ids: string[] } | null>(null);
  const [error, setError] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const query = mode === "position" ? positionQuery.trim() : emailQuery.trim();
    if (!query) return;
    setResults(null);
    setSelected(new Set());
    setImportResult(null);
    setError("");
    setLoading(true);
    const param = mode === "position" ? "position" : "email";
    const res = await fetch(`/api/admin/hiring/sheet-import?${param}=${encodeURIComponent(query)}`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(data.error || "Search failed."); return; }
    setResults(data.candidates);
  }

  function toggleSelect(rowIndex: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex); else next.add(rowIndex);
      return next;
    });
  }

  function selectAll() {
    if (!results) return;
    setSelected(new Set(results.filter((c) => !c.alreadyImported).map((c) => c.rowIndex)));
  }

  async function handleImport() {
    if (!results || selected.size === 0) return;
    setImporting(true);
    setError("");
    const toImport = results.filter((c) => selected.has(c.rowIndex));
    const res = await fetch("/api/admin/hiring/sheet-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: toImport }),
    });
    const data = await res.json().catch(() => ({}));
    setImporting(false);
    if (!res.ok) { setError(data.error || "Import failed."); return; }
    setImportResult(data);
    router.refresh();
  }

  const eligible = results?.filter((c) => !c.alreadyImported) ?? [];

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardHeader}><h2>Search candidates</h2></div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSmall} ${mode === "position" ? "" : styles.btnSecondary}`}
            onClick={() => { setMode("position"); setResults(null); setImportResult(null); }}
          >
            By position
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSmall} ${mode === "email" ? "" : styles.btnSecondary}`}
            onClick={() => { setMode("email"); setResults(null); setImportResult(null); }}
          >
            By email
          </button>
        </div>

        <form onSubmit={search} className={styles.inlineForm}>
          {mode === "position" ? (
            <input
              type="text"
              value={positionQuery}
              onChange={(e) => setPositionQuery(e.target.value)}
              placeholder="e.g. Head of ECE, Mathematics Teacher…"
              className={styles.input}
              disabled={loading}
            />
          ) : (
            <input
              type="email"
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              placeholder="candidate@email.com"
              className={styles.input}
              disabled={loading}
            />
          )}
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={loading || !(mode === "position" ? positionQuery.trim() : emailQuery.trim())}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {error && <p className={styles.error} style={{ marginTop: "0.5rem" }}>{error}</p>}
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className={styles.card} style={{ marginTop: "1rem", background: "#f0fdf4", border: "1px solid #86efac" }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#15803d" }}>
            {importResult.imported} candidate{importResult.imported !== 1 ? "s" : ""} imported.
            {importResult.skipped > 0 && ` ${importResult.skipped} skipped (already in system).`}
          </p>
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div className={styles.card} style={{ marginTop: "1rem" }}>
          <div className={styles.cardHeader} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h2 style={{ marginBottom: 0 }}>
                {results.length === 0 ? "No results" : `${results.length} application${results.length !== 1 ? "s" : ""} found`}
              </h2>
              {eligible.length > 0 && (
                <p className={styles.muted} style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  {eligible.length} not yet in system
                </p>
              )}
            </div>
            {eligible.length > 0 && (
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnSecondary}`} onClick={selectAll}>
                  Select all
                </button>
                {selected.size > 0 && (
                  <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnSecondary}`} onClick={() => setSelected(new Set())}>
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}
                  disabled={selected.size === 0 || importing}
                  onClick={handleImport}
                >
                  {importing ? "Importing…" : `Import ${selected.size > 0 ? selected.size : ""} into system`}
                </button>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Position applied for</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((c) => (
                    <tr key={c.rowIndex} style={{ opacity: c.alreadyImported ? 0.5 : 1 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(c.rowIndex)}
                          disabled={c.alreadyImported}
                          onChange={() => toggleSelect(c.rowIndex)}
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>{c.fullName}</td>
                      <td style={{ fontSize: "0.85rem", color: "var(--ink-muted, #64748b)" }}>{c.email}</td>
                      <td style={{ fontSize: "0.85rem" }}>{c.roleApplied}</td>
                      <td style={{ fontSize: "0.85rem", color: "var(--ink-muted, #64748b)" }}>{c.location}</td>
                      <td>
                        {c.alreadyImported ? (
                          <span className={styles.badge} style={{ background: "#e0f2fe", color: "#0369a1" }}>In system</span>
                        ) : (
                          <span className={styles.badge} style={{ background: "#f1f5f9", color: "#475569" }}>New</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
