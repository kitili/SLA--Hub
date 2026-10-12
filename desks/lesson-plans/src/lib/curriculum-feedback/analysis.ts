import type { FeedbackRow, Series } from "./types";

export type Band = { name: string; min: number; color: string; hex: string; ink: string };

export const STATUS: Band[] = [
  { name: "Strong", min: 3.75, color: "var(--good)", hex: "#0ca30c", ink: "#fff" },
  { name: "Watch", min: 3.25, color: "var(--warning)", hex: "#c48a09", ink: "#fff" },
  { name: "Needs work", min: 2.5, color: "var(--serious)", hex: "#ec835a", ink: "#3a1a0a" },
  { name: "Critical", min: 0, color: "var(--critical)", hex: "#d03b3b", ink: "#fff" },
];

export function band(v: number | null): Band {
  if (v == null || Number.isNaN(v)) return { name: "—", min: 0, color: "#898781", hex: "#898781", ink: "#fff" };
  return STATUS.find((s) => v >= s.min) ?? STATUS[STATUS.length - 1]!;
}

export function avg(rows: FeedbackRow[], key: keyof FeedbackRow): number | null {
  let s = 0, n = 0;
  for (const r of rows) {
    const v = r[key];
    if (typeof v === "number") { s += v; n++; }
  }
  return n ? s / n : null;
}

export function overallAvg(row: FeedbackRow, series: Series[]): number | null {
  const vs = series.map((x) => row[x.key]).filter((x): x is number => typeof x === "number");
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
}

export function meanOverall(rows: FeedbackRow[], series: Series[]): number | null {
  let s = 0, n = 0;
  for (const r of rows) {
    const v = overallAvg(r, series);
    if (v != null) { s += v; n++; }
  }
  return n ? s / n : null;
}

export function fmt(v: number | null): string {
  return v == null ? "—" : (Math.round(v * 100) / 100).toFixed(2);
}

export function fmtDelta(d: number): string {
  const n = (Math.round(Math.abs(d) * 100) / 100).toFixed(2);
  if (Math.abs(d) < 0.005) return "0.00";
  return (d > 0 ? "+" : "−") + n;
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}

export type Group = { name: string; n: number; values: Record<string, number | null>; overall: number | null };

export function groupBy(rows: FeedbackRow[], field: keyof FeedbackRow, series: Series[]): Group[] {
  const m = new Map<string, FeedbackRow[]>();
  for (const r of rows) {
    const k = String(r[field] || "—");
    const list = m.get(k) || [];
    list.push(r);
    m.set(k, list);
  }
  return [...m.entries()].map(([name, g]) => {
    const values: Record<string, number | null> = {};
    for (const s of series) values[s.key] = avg(g, s.key);
    return { name, n: g.length, values, overall: meanOverall(g, series) };
  });
}

export function weekKey(ms: number) {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = ms - day * 864e5;
  const m = new Date(monday);
  return { ts: monday, label: `${m.getUTCMonth() + 1}/${m.getUTCDate()}` };
}

export function weekly(rows: FeedbackRow[], series: Series[]) {
  const m = new Map<number, { label: string; ts: number; rows: FeedbackRow[] }>();
  for (const r of rows) {
    if (!r.whenMs) continue;
    const w = weekKey(r.whenMs);
    const cur = m.get(w.ts) || { label: w.label, ts: w.ts, rows: [] };
    cur.rows.push(r);
    m.set(w.ts, cur);
  }
  return [...m.values()].sort((a, b) => a.ts - b.ts).map((w) => {
    const o: { label: string; ts: number } & Record<string, number | null | string> = { label: w.label, ts: w.ts };
    for (const s of series) o[s.key] = avg(w.rows, s.key);
    return o;
  });
}

const ZONE = "Africa/Nairobi";

function zonedParts(ms: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  }).formatToParts(new Date(ms));
}

export function shortDate(ms: number) {
  if (!ms) return "";
  const parts = zonedParts(ms);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${Number(pick("month"))}/${Number(pick("day"))}/${pick("year")}`;
}

export function longDate(ms: number) {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}
