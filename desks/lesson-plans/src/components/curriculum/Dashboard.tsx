"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { appliedMarkup, groupedBars, lineChart, rankedBars } from "@/components/curriculum/charts";
import { avg, band, fmt, fmtDelta, groupBy, longDate, meanOverall, overallAvg, shortDate, weekly } from "@/lib/curriculum-feedback/analysis";
import { MODES, type ModeKey } from "@/lib/curriculum-feedback/modes";
import type { FeedbackRow } from "@/lib/curriculum-feedback/types";

const STOP = new Set("the a an and or to of is it in for on with that this are be as at we i they them have has not but so more some can need needs should would there their was were my our you your me do does too very just also from by if when which these those about into out up get got us all each its am been being".split(" "));
const COMMENT_PAGE = 8;
const REPORT_PAGE = 10;

function uniq(rows: FeedbackRow[], field: keyof FeedbackRow) {
  return [...new Set(rows.map((r) => String(r[field] || "")).filter((v) => v && v !== "—"))].sort();
}

export default function Dashboard({
  curriculum,
  pd,
  now,
  signedIn,
}: {
  curriculum: FeedbackRow[];
  pd: FeedbackRow[];
  now: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [modeKey, setModeKey] = useState<ModeKey>("curriculum");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [days, setDays] = useState(0);
  const [dim, setDim] = useState<keyof FeedbackRow>("campus");
  const [measure, setMeasure] = useState("overall");
  const [cmtDim, setCmtDim] = useState("all");
  const [theme, setTheme] = useState("");
  const [cmtQuery, setCmtQuery] = useState("");
  const [repQuery, setRepQuery] = useState("");
  const [repSort, setRepSort] = useState("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [cmtPage, setCmtPage] = useState(0);
  const [repPage, setRepPage] = useState(0);

  const mode = MODES[modeKey];
  const rows = modeKey === "pd" ? pd : curriculum;

  const filtered = useMemo(() => {
    const cutoff = days ? now - days * 864e5 : 0;
    return rows.filter((r) => {
      for (const f of mode.filters) {
        const want = filters[f.field];
        if (want && r[f.field] !== want) return false;
      }
      if (cutoff && r.whenMs && r.whenMs < cutoff) return false;
      return true;
    });
  }, [rows, mode, filters, days, now]);

  const prior = useMemo(() => {
    if (!days) return [];
    const end = now - days * 864e5;
    const start = end - days * 864e5;
    return rows.filter((r) => {
      for (const f of mode.filters) {
        const want = filters[f.field];
        if (want && r[f.field] !== want) return false;
      }
      return r.whenMs >= start && r.whenMs < end;
    });
  }, [rows, mode, filters, days, now]);

  const reportNos = useMemo(() => {
    const ordered = rows.slice().sort((a, b) => a.whenMs - b.whenMs);
    const map: Record<string, number> = {};
    ordered.forEach((r, i) => { map[r.id] = i + 1; });
    return map;
  }, [rows]);

  const overall = meanOverall(filtered, mode.series);
  const overallBand = band(overall);
  const seriesRank = mode.series.map((s) => ({ s, a: avg(filtered, s.key) })).filter((x) => x.a != null).sort((a, b) => (a.a || 0) - (b.a || 0));
  const groups = groupBy(filtered, mode.groupField, mode.series).filter((g) => g.n >= 2 && g.overall != null).sort((a, b) => (a.overall || 0) - (b.overall || 0));
  const low = groups[0];
  const rated = filtered.filter((r) => overallAvg(r, mode.series) != null);
  const below = rated.filter((r) => (overallAvg(r, mode.series) || 0) < 3.25).length;
  const pct = rated.length ? Math.round((below / rated.length) * 100) : 0;

  let landing = groupBy(filtered, mode.groupField, mode.series).sort((a, b) => (a.overall == null ? 99 : a.overall) - (b.overall == null ? 99 : b.overall) || a.name.localeCompare(b.name));
  const solid = landing.filter((g) => g.n >= 2);
  if (solid.length) landing = solid;
  const more = landing.length > 10 ? landing.length - 10 : 0;
  if (more) landing = landing.slice(0, 10);

  const breakdown = groupBy(filtered, dim, mode.series).map((g) => ({
    name: g.name,
    n: g.n,
    value: measure === "overall" ? g.overall : g.values[measure] ?? null,
  }));

  const comments = filtered.flatMap((r) => mode.comments.filter((c) => r[c.field]).map((c) => ({ dim: c.dim, text: String(r[c.field]), r })));
  const themePool = comments.filter((c) => cmtDim === "all" || c.dim === cmtDim);
  const freq: Record<string, number> = {};
  for (const c of themePool) {
    const seen = new Set<string>();
    for (const w of c.text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)) {
      if (w.length < 3 || STOP.has(w) || seen.has(w)) continue;
      seen.add(w);
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  const themes = Object.entries(freq).map(([w, c]) => ({ w, c })).filter((t) => t.c >= 2).sort((a, b) => b.c - a.c).slice(0, 12);
  const shownComments = comments.filter((c) => {
    if (cmtDim !== "all" && c.dim !== cmtDim) return false;
    if (theme && !c.text.toLowerCase().includes(theme)) return false;
    if (cmtQuery && !c.text.toLowerCase().includes(cmtQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => b.r.whenMs - a.r.whenMs);

  const reports = filtered.slice().sort((a, b) => {
    if (repSort === "oldest") return a.whenMs - b.whenMs;
    if (repSort === "name") return a.teacher.localeCompare(b.teacher);
    if (repSort === "low" || repSort === "high") {
      const av = overallAvg(a, mode.series), bv = overallAvg(b, mode.series);
      const d = (av == null ? 99 : av) - (bv == null ? 99 : bv);
      return repSort === "low" ? d : -d;
    }
    return b.whenMs - a.whenMs;
  }).filter((r) => {
    if (!repQuery) return true;
    const blob = [r.teacher, r.campus, r.role, r.tool, r.topic, r.facilitator, r.ref, ...mode.comments.map((c) => r[c.field])].join(" ").toLowerCase();
    return blob.includes(repQuery.toLowerCase());
  });

  useEffect(() => { setCmtPage(0); }, [modeKey, filters, days, cmtDim, theme, cmtQuery]);
  useEffect(() => { setRepPage(0); }, [modeKey, filters, days, repQuery, repSort]);

  const cmtPages = Math.max(1, Math.ceil(shownComments.length / COMMENT_PAGE));
  const cmtPageSafe = Math.min(cmtPage, cmtPages - 1);
  const commentSlice = shownComments.slice(cmtPageSafe * COMMENT_PAGE, (cmtPageSafe + 1) * COMMENT_PAGE);
  const repPages = Math.max(1, Math.ceil(reports.length / REPORT_PAGE));
  const repPageSafe = Math.min(repPage, repPages - 1);
  const reportSlice = reports.slice(repPageSafe * REPORT_PAGE, (repPageSafe + 1) * REPORT_PAGE);

  const open = openId ? rows.find((r) => r.id === openId) || null : null;
  const filtersOn = days !== 0 || mode.filters.some((f) => filters[f.field]);
  const showDelta = days > 0 && prior.length >= 3;

  function setMode(next: ModeKey) {
    setModeKey(next);
    setFilters({});
    setDim(MODES[next].segDims[0]?.val ?? "campus");
    setMeasure("overall");
    setCmtDim("all");
    setTheme("");
    setOpenId(null);
  }

  function setFilter(field: string, value: string) {
    setFilters((cur) => ({ ...cur, [field]: value }));
  }

  function exportCsv() {
    if (!filtered.length) return;
    const cols = mode.csvCols;
    const lines = [cols.join(",")];
    for (const r of filtered) {
      lines.push(cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = mode.csvName;
    a.click();
  }

  const applied = mode.applied ? appliedMarkup(filtered) : null;
  const recent = !days ? rows.filter((r) => r.whenMs && r.whenMs >= now - 30 * 864e5 && mode.filters.every((f) => !filters[f.field] || r[f.field] === filters[f.field])) : [];
  const recentAvg = meanOverall(recent, mode.series);
  const prevAvg = meanOverall(prior, mode.series);
  const delta = overall != null && prevAvg != null ? overall - prevAvg : null;

  return (
    <div className="wrap">
      <header className="top">
        <span className="brand-logo" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="265 240 303 390"><g fill="#fff"><path d="m408.57,247.42v160.1l-128.39-128.39c16.26-9.47,59.43-30.16,128.39-31.7Z"/><polygon points="408.57 430.64 408.57 533.57 272.84 397.84 272.84 294.89 408.57 430.64"/><path d="m272.84,420.93l135.72,135.72v65.15c-31.4-4.23-83.02-31.23-108.59-77.96-18.49-33.79-27.13-72.06-27.13-110.57v-12.34Z"/><path d="m560.62,420.93l-135.72,135.72v65.15c31.4-4.23,83.02-31.23,108.59-77.96,18.49-33.79,27.13-72.06,27.13-110.57v-12.34Z"/><path d="m553.33,279.14l-128.43,128.45v-160.17c69.01,1.54,112.21,22.25,128.43,31.72Z"/><polygon points="560.62 294.97 560.62 397.9 424.9 533.62 424.9 430.69 560.62 294.97"/></g></svg>
        </span>
        <div className="htext">
          <span className="hsup">Silverleaf Academy</span>
          <h1>{mode.subtitle}</h1>
        </div>
        <div className="hactions">
          <button className="btn" type="button" onClick={() => router.refresh()}>↻ Refresh</button>
          <button className="btn" type="button" onClick={exportCsv}>⇩ CSV</button>
          {signedIn && (
            <form action="/api/logout" method="post">
              <button className="btn" type="submit">Sign out</button>
            </form>
          )}
        </div>
        <span className="meta">{rows.length} {modeKey === "pd" ? "PD" : "curriculum"} response{rows.length === 1 ? "" : "s"} · Neon</span>
      </header>

      <div className="modebar">
        <span className="mlbl">View</span>
        <div className="seg big">
          <button type="button" className={modeKey === "curriculum" ? "on" : ""} onClick={() => setMode("curriculum")}>Curriculum tools</button>
          <button type="button" className={modeKey === "pd" ? "on" : ""} onClick={() => setMode("pd")}>Professional development</button>
        </div>
      </div>

      <div className={"filters" + (filtersOn ? " active" : "")}>
        {mode.filters.map((f) => (
          <div className="f" key={f.field}>
            <label>{f.label}</label>
            <select value={filters[f.field] || ""} onChange={(e) => setFilter(f.field, e.target.value)}>
              <option value="">{f.all}</option>
              {uniq(rows, f.field).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ))}
        <div className="f">
          <label>Period</label>
          <select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
            <option value="0">All time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
          </select>
        </div>
        <div className="f" style={{ flex: 1 }}>
          <label>&nbsp;</label>
          <button className="btn" type="button" hidden={!filtersOn} onClick={() => { setFilters({}); setDays(0); }}>Clear filters</button>
        </div>
        <div className="f"><label>&nbsp;</label><span className="count">{filtered.length} response{filtered.length === 1 ? "" : "s"}</span></div>
      </div>
      <p className="norm-hint">Campus, role, session, and facilitator names are grouped when they are the same thing spelled differently. Responses are stored in Neon.</p>

      <section className="card brief" role="status">
        {!filtered.length ? <p className="empty" style={{ margin: 0 }}>No responses in this view. Clear a filter or wait for new feedback.</p> : (
          <>
            <div className="brief-top">
              <span className="brief-kicker">Readout</span>
              {overall != null && <span className="pill" style={{ background: overallBand.hex, color: overallBand.ink }}>{overallBand.name}</span>}
            </div>
            <p className="brief-lead">Overall <b>{fmt(overall)}</b> across <b>{filtered.length}</b> response{filtered.length === 1 ? "" : "s"}.</p>
            <p className="brief-body">
              {seriesRank[0] && <>{seriesRank[0].s.label} is the softest area at <b>{fmt(seriesRank[0].a)}</b>. </>}
              {low && groups.length > 1 && <>{low.name} is the lowest {mode.noun} at <b>{fmt(low.overall)}</b> (n={low.n}). </>}
              {rated.length > 0 && <><b>{pct}%</b> of rated responses sit below 3.25. </>}
              {!days && recent.length >= 3 && recentAvg != null && <>Last 30 days: <b>{fmt(recentAvg)}</b> across {recent.length} responses.</>}
              {days > 0 && delta != null && prevAvg != null && prior.length >= 3 && (
                Math.abs(delta) < 0.05
                  ? <> Overall is about the same as the previous window ({fmt(prevAvg)}, n={prior.length}).</>
                  : <> Overall is <b className={"delta " + (delta > 0 ? "up" : "down")}>{delta > 0 ? "up" : "down"} {fmt(Math.abs(delta))}</b> versus the previous window (was {fmt(prevAvg)}, n={prior.length}).</>
              )}
            </p>
            <div className="legend" aria-label="Score bands">
              <span><i className="sw" style={{ background: "var(--good)" }} />Strong ≥ 3.75</span>
              <span><i className="sw" style={{ background: "var(--warning)" }} />Watch ≥ 3.25</span>
              <span><i className="sw" style={{ background: "var(--serious)" }} />Needs work ≥ 2.50</span>
              <span><i className="sw" style={{ background: "var(--critical)" }} />Critical below 2.50</span>
            </div>
            {mode.series.map((s) => {
              const counts = [0, 0, 0, 0, 0];
              let total = 0;
              for (const r of filtered) {
                const v = r[s.key];
                if (typeof v !== "number") continue;
                const i = Math.max(0, Math.min(4, Math.round(v) - 1));
                counts[i] = (counts[i] ?? 0) + 1; total++;
              }
              return (
                <div className="dist-row" key={s.key}>
                  <span className="dist-name">{s.label}</span>
                  <span className="dist-bar">
                    {counts.map((c, i) => {
                      if (!c || !total) return null;
                      const b = band(i + 1);
                      const w = (c / total) * 100;
                      return <i key={i} style={{ width: `${w}%`, background: b.hex, color: b.ink }} title={`${i + 1}: ${c} of ${total}`}>{w >= 9 ? c : ""}</i>;
                    })}
                  </span>
                </div>
              );
            })}
            <div className="dist-scale"><span><em>score 1</em><em>score 5</em></span></div>
          </>
        )}
      </section>

      <div className="grid kpis">
        <article className="card kpi">
          <div className="label">Responses</div>
          <div className="num">{filtered.length}</div>
          {showDelta && <span className="delta flat">{filtered.length - prior.length > 0 ? "+" : ""}{filtered.length - prior.length} vs prior</span>}
        </article>
        {mode.series.map((s) => {
          const a = avg(filtered, s.key);
          const b = band(a);
          const prev = showDelta ? avg(prior, s.key) : null;
          const d = a != null && prev != null ? a - prev : null;
          return (
            <article className="card kpi" key={s.key}>
              <div className="label">{s.label}</div>
              <div className="num" style={a == null ? undefined : { color: b.hex }}>{fmt(a)} <span className="of">/ 5</span></div>
              {a != null && <div className="meter"><i style={{ width: `${(Math.max(0, Math.min(5, a)) / 5) * 100}%`, background: b.color }} /></div>}
              {a != null && <div className="status" style={{ color: b.hex }}>{b.name}</div>}
              {d != null && <span className={"delta " + (d > 0.049 ? "up" : d < -0.049 ? "down" : "flat")}>{fmtDelta(d)} vs prior</span>}
            </article>
          );
        })}
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>{mode.groupTitle}</h2>
        <p className="hint">{mode.groupHint}{more ? ` Showing the 10 lowest with 2 or more responses (${more} more in the filter).` : ""}</p>
        <div className="legend">{mode.series.map((s) => <span key={s.key}><i className="sw" style={{ background: s.color }} />{s.label}</span>)}</div>
        <div className="chart-scroll" onClick={(e) => {
          const g = (e.target as Element).closest?.("[data-value]");
          const value = g?.getAttribute("data-value");
          if (value && value !== "—") setFilter(mode.groupField, value);
        }} dangerouslySetInnerHTML={{ __html: groupedBars(landing, mode.series) }} />
      </section>

      {applied && (
        <section className="card" style={{ marginTop: 14 }}>
          <h2>Are teachers applying it?</h2>
          <p className="hint">Share of teachers by how far they have taken each session into their classroom.</p>
          <div className="legend" dangerouslySetInnerHTML={{ __html: applied.legend }} />
          <div className="chart-scroll" dangerouslySetInnerHTML={{ __html: applied.svg }} />
        </section>
      )}

      <section className="card" style={{ marginTop: 14 }}>
        <h2>Where to focus</h2>
        <p className="hint">Ranked lowest first. The dashed line is 3.25, where Watch begins.</p>
        <div className="ctrls">
          <span className="count">Break down by</span>
          <div className="seg">{mode.segDims.map((d) => <button type="button" key={d.val} className={dim === d.val ? "on" : ""} onClick={() => setDim(d.val)}>{d.label}</button>)}</div>
          <span className="count">Measure</span>
          <div className="seg">{mode.measures.map((m) => <button type="button" key={m.val} className={measure === m.val ? "on" : ""} onClick={() => setMeasure(m.val)}>{m.label}</button>)}</div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: rankedBars(breakdown) }} />
      </section>

      <div className="grid two" style={{ marginTop: 14 }}>
        <section className="card">
          <h2>Trend over time</h2>
          <p className="hint">Weekly average per area.</p>
          <div className="legend">{mode.series.map((s) => <span key={s.key}><i className="sw" style={{ background: s.color }} />{s.label}</span>)}</div>
          <div dangerouslySetInnerHTML={{ __html: lineChart(weekly(filtered, mode.series), mode.series) }} />
        </section>
        <section className="card">
          <h2>Top priorities to fix</h2>
          <p className="hint">{mode.priorityHint}</p>
          <Priority rows={filtered} modeKey={modeKey} onPick={(parts) => {
            mode.filters.forEach((f, i) => { if (parts[i] && parts[i] !== "—") setFilter(f.field, parts[i]); });
          }} />
        </section>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>What teachers are saying</h2>
        <p className="hint">Common themes first. Tap a theme to filter.</p>
        <div className="ctrls">
          <div className="seg">
            <button type="button" className={cmtDim === "all" ? "on" : ""} onClick={() => { setCmtDim("all"); setTheme(""); }}>All</button>
            {mode.comments.map((c) => <button type="button" key={c.dim} className={cmtDim === c.dim ? "on" : ""} onClick={() => { setCmtDim(c.dim); setTheme(""); }}>{c.tag}</button>)}
          </div>
          <input type="search" value={cmtQuery} placeholder="Search comments…" onChange={(e) => setCmtQuery(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          {themes.length > 0 && <span className={"chip" + (theme === "" ? " on" : "")} onClick={() => setTheme("")}>All themes</span>}
          {themes.map((t) => <span key={t.w} className={"chip" + (theme === t.w ? " on" : "")} onClick={() => setTheme(theme === t.w ? "" : t.w)}>{t.w} <b className="chip-n">{t.c}</b></span>)}
        </div>
        {!shownComments.length ? <p className="empty">No comments match.</p> : commentSlice.map((c, i) => {
          const def = mode.comments.find((x) => x.dim === c.dim);
          const meta = mode.applied ? `${c.r.topic} · ${c.r.campus} · ${c.r.teacher}` : `${c.r.tool} · ${c.r.campus} · ${c.r.role} · ${c.r.teacher}`;
          return <div className="cmt" key={c.r.id + c.dim + i}><div className="who"><span className="tag" style={{ background: def?.hex }}>{def?.tag}</span>{meta}</div>{c.text}</div>;
        })}
        <Pager page={cmtPageSafe} pages={cmtPages} total={shownComments.length} pageSize={COMMENT_PAGE} onPage={setCmtPage} />
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>Individual reports</h2>
        <p className="hint">Every response, one report per entry. Open one to print or save it as a PDF.</p>
        <div className="ctrls">
          <input type="search" value={repQuery} placeholder="Search name, campus, role, comments…" onChange={(e) => setRepQuery(e.target.value)} style={{ flex: 1, minWidth: 190 }} />
          <select value={repSort} onChange={(e) => setRepSort(e.target.value)}>
            <option value="recent">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="low">Lowest score first</option>
            <option value="high">Highest score first</option>
            <option value="name">By name (A–Z)</option>
          </select>
          <span className="count">{reports.length} report{reports.length === 1 ? "" : "s"}</span>
        </div>
        <div className="rep-list">
          {!reports.length ? <p className="empty" style={{ padding: 14 }}>No entries match.</p> : reportSlice.map((r) => {
            const ov = overallAvg(r, mode.series);
            const b = band(ov);
            return (
              <button type="button" className="rep-row" key={r.id} onClick={() => setOpenId(r.id)}>
                <span className="rep-row-no">#{reportNos[r.id]}</span>
                <span className="rep-row-main"><b>{r.teacher}</b><span className="rep-row-sub">{r.campus} · {r.role} · {mode.applied ? r.topic : r.tool}</span></span>
                <span className="rep-row-when">{shortDate(r.whenMs)}</span>
                <span className="rep-row-badge" style={{ background: b.hex }}>{fmt(ov)}</span>
                <span className="rep-row-chev">›</span>
              </button>
            );
          })}
        </div>
        <Pager page={repPageSafe} pages={repPages} total={reports.length} pageSize={REPORT_PAGE} onPage={setRepPage} />
      </section>

      <p className="footer-note">{mode.footer}</p>

      <div className={"modal" + (open ? " show" : "")} onClick={(e) => { if (e.target === e.currentTarget) setOpenId(null); }}>
        {open && (
          <div className="sheet">
            <div className="rep-id">Silverleaf Academy · Report #{reportNos[open.id]}</div>
            <h3 className="rep-title">{mode.reportTitle}</h3>
            <div className="rep-meta">
              <Meta label="Name" value={open.teacher} />
              <Meta label="Campus" value={open.campus} />
              <Meta label="Role" value={open.role} />
              <Meta label="Submitted" value={longDate(open.whenMs)} />
              {mode.applied ? (
                <>
                  <Meta label="Session" value={open.topic} />
                  <Meta label="Facilitator" value={open.facilitator} />
                  <Meta label="Session date" value={open.pd_date} />
                  <Meta label="Applied it yet?" value={open.applied} />
                </>
              ) : (
                <>
                  <Meta label="Tool" value={open.tool} />
                  {open.ref ? <Meta label="Reference" value={open.ref} /> : null}
                </>
              )}
            </div>
            <div className="rep-sec">Ratings</div>
            {mode.series.map((s) => <Rate key={s.key} label={s.label} value={typeof open[s.key] === "number" ? open[s.key] as number : null} />)}
            <Rate label="Overall" value={overallAvg(open, mode.series)} strong />
            <div className="rep-sec">Comments & notes</div>
            {mode.comments.filter((c) => open[c.field]).map((c) => (
              <div className="rep-cmt" key={c.dim}><span className="rep-cmt-tag">{c.tag}</span><div className="rep-cmt-text">{String(open[c.field])}</div></div>
            ))}
            {!mode.comments.some((c) => open[c.field]) && <p className="empty">No written comments on this entry.</p>}
            <div className="row rep-actions">
              <button className="btn" type="button" style={{ flex: 1 }} onClick={() => { document.body.classList.add("printing"); window.print(); setTimeout(() => document.body.classList.remove("printing"), 600); }}>Print / Save as PDF</button>
              <button className="btn primary" type="button" style={{ flex: 1 }} onClick={() => setOpenId(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Pager({
  page,
  pages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const start = page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="pager">
      <span className="count">{start}–{end} of {total}</span>
      <div className="pager-nav">
        <button type="button" className="btn" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="count">Page {page + 1} of {pages}</span>
        <button type="button" className="btn" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return <div className="rep-mi"><span className="rep-mi-l">{label}</span><span className="rep-mi-v">{value}</span></div>;
}

function Rate({ label, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  const b = band(value);
  return (
    <div className={"rep-rate" + (strong ? " strong" : "")}>
      <span className="rep-rate-l">{label}</span>
      <span className="rep-rate-bar"><i style={{ width: `${value == null ? 0 : (value / 5) * 100}%`, background: b.hex }} /></span>
      <span className="rep-rate-v" style={{ color: value == null ? "var(--muted)" : b.hex }}>{fmt(value)}{value == null ? "" : " / 5"}</span>
    </div>
  );
}

function Priority({ rows, modeKey, onPick }: { rows: FeedbackRow[]; modeKey: ModeKey; onPick: (parts: string[]) => void }) {
  const mode = MODES[modeKey];
  const m = new Map<string, FeedbackRow[]>();
  for (const r of rows) {
    const k = mode.priorityKey(r);
    const list = m.get(k) || [];
    list.push(r);
    m.set(k, list);
  }
  const items = [...m.entries()].map(([k, g]) => {
    const vals = mode.series.map((s) => avg(g, s.key)).filter((x): x is number => x != null);
    return { parts: k.split(" ‖ "), n: g.length, vals: mode.series.map((s) => avg(g, s.key)), low: vals.length ? Math.min(...vals) : 99 };
  }).filter((x) => x.n >= 2).sort((a, b) => a.low - b.low).slice(0, 8);
  if (!items.length) return <p className="empty">Once a few people rate the same {mode.noun}, priorities appear here.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>{mode.priorityHead}</th>
          {mode.priorityCols.map((c) => <th className="num" key={c}>{c}</th>)}
          <th className="num">n</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => {
          const lab = mode.priorityLabel(it.parts);
          return (
            <tr className="clickable" key={it.parts.join("|")} onClick={() => onPick(it.parts)}>
              <td><b>{lab.main}</b>{lab.sub ? <><br /><span style={{ color: "var(--ink2)" }}>{lab.sub}</span></> : null}</td>
              {it.vals.map((v, i) => <td className="num" key={i}><span className="dot" style={{ background: band(v).hex }} />{fmt(v)}</td>)}
              <td className="num">{it.n}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
