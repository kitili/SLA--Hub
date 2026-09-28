"use client";

import { useEffect, useMemo, useState } from "react";
import { VisitRecord } from "@/domain/Visit";
import { VisitCsvExporter } from "@/services/VisitCsvExporter";
import { fetchVisits } from "@/lib/visits-client";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardView({ campus }: { campus: string }) {
  const [dateFrom, setDateFrom] = useState(todayKey());
  const [dateTo, setDateTo] = useState(todayKey());
  const [status, setStatus] = useState<"all" | "on-site" | "left">("all");
  const [source, setSource] = useState<"all" | "desk" | "self">("all");
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const params: Parameters<typeof fetchVisits>[0] = {
        campus,
        dateFrom,
        dateTo,
      };
      if (status === "on-site") params.onSite = true;
      if (status === "left") params.signedOut = true;
      if (source !== "all") params.source = source;
      setVisits(await fetchVisits(params));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, status, source, campus]);

  const stats = useMemo(
    () => ({
      total: visits.length,
      onSite: visits.filter((visit) => !visit.signedOutAt).length,
      self: visits.filter((visit) => visit.source === "self").length,
      desk: visits.filter((visit) => visit.source === "desk").length,
    }),
    [visits],
  );

  function exportCsv() {
    if (visits.length === 0) return;
    const csv = new VisitCsvExporter().export(visits);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `visitor-log-${campus.replace(/\s+/g, "-").toLowerCase()}-${dateFrom}-to-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="stat-row">
        <div className="stat-card stat-card--blue">
          <div className="num">{stats.total}</div>
          <div className="label">Total visits · {campus}</div>
        </div>
        <div className="stat-card stat-card--gold">
          <div className="num">{stats.onSite}</div>
          <div className="label">Currently on site</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="num">{stats.self}</div>
          <div className="label">QR self check-ins</div>
        </div>
        <div className="stat-card stat-card--navy">
          <div className="num">{stats.desk}</div>
          <div className="label">Front desk sign-ins</div>
        </div>
      </div>

      <div className="dash-controls card dash-filters">
        <div className="filter-group">
          <label htmlFor="dateFrom">From</label>
          <input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="dateTo">To</label>
          <input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="status">Status</label>
          <select id="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">All visitors</option>
            <option value="on-site">On site now</option>
            <option value="left">Signed out</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="source">Check-in type</label>
          <select id="source" value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
            <option value="all">All types</option>
            <option value="desk">Front desk</option>
            <option value="self">QR self</option>
          </select>
        </div>
        <button type="button" className="export-btn" onClick={exportCsv} disabled={visits.length === 0}>
          Export CSV
        </button>
      </div>

      {error ? <p className="form-msg err">{error}</p> : null}

      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Purpose</th>
              <th>Host</th>
              <th>Source</th>
              <th>Date</th>
              <th>Signed in</th>
              <th>Signed out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visits.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "var(--ink-muted)", padding: 30 }}>
                  No visits recorded for this campus and date range.
                </td>
              </tr>
            ) : (
              visits.map((visit) => (
                <tr key={visit.id}>
                  <td>
                    <div className="history-visitor">
                      <div className="avatar small">
                        {visit.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={visit.photo} alt="" />
                        ) : (
                          visit.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div>{visit.name}</div>
                        <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>{visit.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td>{visit.purpose}</td>
                  <td>{visit.host}</td>
                  <td className="source-chip">{visit.source === "self" ? "QR self" : "Front desk"}</td>
                  <td>{formatDate(visit.signedInAt)}</td>
                  <td>{formatTime(visit.signedInAt)}</td>
                  <td>{visit.signedOutAt ? formatTime(visit.signedOutAt) : "—"}</td>
                  <td>
                    <span className={`status-chip ${visit.signedOutAt ? "left" : "on-site"}`}>
                      {visit.signedOutAt ? "Left" : "On site"}
                    </span>
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
