"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type StatusRow = {
  driver_id: string;
  name: string;
  active: boolean;
  phone: string | null;
  linked: boolean;
  email: string | null;
  user_id: string | null;
  suggested_email: string;
};

type ProvisionResult = {
  driver_id: string;
  driver_name: string;
  email: string;
  user_id: string;
  action: string;
  temporary_password: string | null;
  error?: string;
};

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map((c) => escape(c ?? "")).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DriverBulkProvision() {
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [domain, setDomain] = useState("silverleaf.co.tz");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [emailOverrides, setEmailOverrides] = useState<Record<string, string>>(
    {},
  );
  const [passwordMode, setPasswordMode] = useState<
    "generate" | "shared" | "none"
  >("generate");
  const [sharedPassword, setSharedPassword] = useState("");
  const [results, setResults] = useState<ProvisionResult[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/drivers/provision");
      const data = (await res.json()) as {
        drivers?: StatusRow[];
        domain?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setDomain(data.domain ?? "silverleaf.co.tz");
      const list = data.drivers ?? [];
      setRows(list);
      const nextSel: Record<string, boolean> = {};
      for (const r of list) {
        if (!r.linked && r.active) nextSel[r.driver_id] = true;
      }
      setSelected(nextSel);
    } catch {
      setError("Network error loading login status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unlinked = useMemo(
    () => rows.filter((r) => !r.linked && r.active),
    [rows],
  );
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  async function runProvision(allUnlinked: boolean) {
    setBusy(true);
    setError(null);
    setResults(null);
    setSummary(null);
    try {
      const body: Record<string, unknown> = {
        passwordMode,
        emailDomain: domain,
      };
      if (passwordMode === "shared") {
        if (!sharedPassword.trim()) {
          setError("Enter a shared temporary password");
          setBusy(false);
          return;
        }
        body.sharedPassword = sharedPassword.trim();
      }
      if (allUnlinked) {
        body.allUnlinked = true;
      } else {
        body.items = selectedIds.map((driverId) => ({
          driverId,
          email: emailOverrides[driverId] || undefined,
        }));
      }

      const res = await fetch("/api/drivers/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        summary?: { created: number; linked: number; failed: number; total: number };
        results?: ProvisionResult[];
        note?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setResults(data.results ?? []);
      const s = data.summary;
      setSummary(
        data.message ??
          (s
            ? `Created ${s.created}, linked ${s.linked}, failed ${s.failed} (of ${s.total}). ${data.note ?? ""}`
            : "Done"),
      );
      await load();
    } catch {
      setError("Network error during provision");
    } finally {
      setBusy(false);
    }
  }

  function exportCredentials() {
    if (!results?.length) return;
    downloadCsv("driver-logins.csv", [
      ["driver_name", "email", "temporary_password", "action", "error"],
      ...results.map((r) => [
        r.driver_name,
        r.email,
        r.temporary_password ?? "",
        r.action,
        r.error ?? "",
      ]),
    ]);
  }

  return (
    <section className="rounded-[var(--radius)] border border-electric-blue/20 bg-white p-4 shadow-[var(--shadow)]">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Bulk provision Matron app logins
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        Creates one Auth account per fleet person (@{domain}), sets role to
        matron, and links their record. Download the CSV of temporary
        passwords immediately — they are shown once.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-ink-muted">Loading login status…</p>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold text-ink">
            {rows.filter((r) => r.linked).length} linked · {unlinked.length}{" "}
            active without login
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Password mode</span>
              <select
                value={passwordMode}
                onChange={(e) =>
                  setPasswordMode(e.target.value as typeof passwordMode)
                }
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
              >
                <option value="generate">Unique temp password each</option>
                <option value="shared">Same temp password for all</option>
                <option value="none">Link existing Auth only</option>
              </select>
            </label>
            {passwordMode === "shared" ? (
              <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Shared password</span>
                <input
                  type="text"
                  value={sharedPassword}
                  onChange={(e) => setSharedPassword(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
                  placeholder="Hand out once, then change"
                />
              </label>
            ) : null}
          </div>

          {unlinked.length > 0 ? (
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-[var(--radius-sm)] border border-card-border p-2">
              {unlinked.map((r) => (
                <li
                  key={r.driver_id}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selected[r.driver_id])}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [r.driver_id]: e.target.checked,
                      }))
                    }
                  />
                  <span className="min-w-[8rem] font-semibold text-ink">
                    {r.name}
                  </span>
                  <input
                    type="email"
                    value={emailOverrides[r.driver_id] ?? r.suggested_email}
                    onChange={(e) =>
                      setEmailOverrides((prev) => ({
                        ...prev,
                        [r.driver_id]: e.target.value,
                      }))
                    }
                    className="min-w-[14rem] flex-1 rounded-[var(--radius-sm)] border border-card-border px-2 py-1 text-xs"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-success">
              Every active driver already has a linked login.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || selectedIds.length === 0}
              onClick={() => void runProvision(false)}
              className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy
                ? "Provisioning…"
                : `Provision selected (${selectedIds.length})`}
            </button>
            <button
              type="button"
              disabled={busy || unlinked.length === 0}
              onClick={() => void runProvision(true)}
              className="rounded-[var(--radius-sm)] border border-electric-blue px-4 py-2 text-sm font-semibold text-electric-blue disabled:opacity-60"
            >
              Provision all unlinked ({unlinked.length})
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void load()}
              className="text-sm font-semibold text-ink-muted hover:underline"
            >
              Refresh
            </button>
          </div>
        </>
      )}

      {error ? (
        <p className="mt-3 text-sm font-semibold text-danger">{error}</p>
      ) : null}
      {summary ? (
        <p className="mt-3 text-sm font-semibold text-success">{summary}</p>
      ) : null}

      {results && results.length > 0 ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              Credentials (this run only)
            </p>
            <button
              type="button"
              onClick={exportCredentials}
              className="text-xs font-bold text-electric-blue hover:underline"
            >
              Download CSV
            </button>
          </div>
          <div className="mt-2 max-h-48 overflow-auto rounded-[var(--radius-sm)] border border-card-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f7f9fc] text-ink-muted">
                <tr>
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Email</th>
                  <th className="px-2 py-1.5">Password</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.driver_id} className="border-t border-card-border">
                    <td className="px-2 py-1.5 font-semibold">{r.driver_name}</td>
                    <td className="px-2 py-1.5 font-mono">{r.email}</td>
                    <td className="px-2 py-1.5 font-mono">
                      {r.temporary_password ?? "—"}
                    </td>
                    <td
                      className={`px-2 py-1.5 ${
                        r.error ? "text-danger" : "text-success"
                      }`}
                    >
                      {r.error ?? r.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
