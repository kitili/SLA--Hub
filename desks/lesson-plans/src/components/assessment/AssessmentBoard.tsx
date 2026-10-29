"use client";

import { useMemo, useState } from "react";

import { mean } from "@/lib/assessment/metrics";
import { AcademicsHomeLink } from "@/components/BoardChrome";
import styles from "@/components/academics/board.module.css";

export type AssessmentBoardPoint = {
  school: string;
  grade: string;
  round: string;
  tool: string;
  value: number | null;
  band: string | null;
  studentRef: string | null;
};

const GRADES = ["KG", "G1", "G2", "G3", "G4", "G5", "G6", "G7"];
const TOOLS = ["EGRA", "EGMA", "SEL"];

export default function AssessmentBoard({
  points,
  admin,
  source,
}: {
  points: AssessmentBoardPoint[];
  admin: boolean;
  source: "live" | "offline" | "empty";
}) {
  const [school, setSchool] = useState("All");
  const [grade, setGrade] = useState("All");
  const [round, setRound] = useState("All");
  const [tool, setTool] = useState("EGRA");
  const [tab, setTab] = useState<"overview" | "growth" | "students">("overview");
  const schools = useMemo(() => [...new Set(points.map((point) => point.school))].sort(), [points]);
  const rounds = useMemo(() => [...new Set(points.map((point) => point.round))].sort(), [points]);
  const filtered = points.filter((point) =>
    (school === "All" || point.school === school) &&
    (grade === "All" || point.grade === grade) &&
    (round === "All" || point.round === round) &&
    (tool === "All" || point.tool === tool),
  );
  const values = filtered.map((point) => point.value).filter((value): value is number => value != null);
  const bands = ["Non-reader (0)", "Beginning (1–19)", "Emerging (20–44)", "Fluent (45+)"];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <AcademicsHomeLink className={styles.home}>Academics</AcademicsHomeLink>
        <h1>Assessment dashboard</h1>
        <p>EGRA, EGMA and social-emotional results, read the same way as the live leadership dashboard.</p>
      </header>
      {source === "offline" ? <p className={styles.note}>Showing the copy saved on this computer.</p> : null}
      {source === "empty" ? (
        <p className={styles.note}>No assessment records are in the shared database yet.</p>
      ) : null}
      {!admin ? <p className={styles.note}>Pupil references stay with Academics admins. This page shows school and grade totals.</p> : null}

      <div className={styles.filters}>
        <label>School
          <select value={school} onChange={(event) => setSchool(event.target.value)}>
            <option>All</option>
            {schools.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Grade
          <select value={grade} onChange={(event) => setGrade(event.target.value)}>
            <option>All</option>
            {GRADES.filter((item) => points.some((point) => point.grade === item)).map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Round
          <select value={round} onChange={(event) => setRound(event.target.value)}>
            <option>All</option>
            {rounds.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Assessment
          <select value={tool} onChange={(event) => setTool(event.target.value)}>
            {TOOLS.map((item) => <option key={item}>{item}</option>)}
            <option>All</option>
          </select>
        </label>
      </div>

      <section className={styles.tiles}>
        <article className={styles.tile}><span>Records</span><strong>{filtered.length}</strong></article>
        <article className={styles.tile}><span>With a headline score</span><strong>{values.length}</strong></article>
        <article className={styles.tile}><span>Average</span><strong>{mean(values) ?? "—"}</strong></article>
      </section>

      <div className={styles.tabs}>
        {(["overview", "growth", "students"] as const).map((item) => (
          <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>
            {item === "overview" ? "Results" : item === "growth" ? "Baseline to endline" : "Pupils"}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <section className={styles.card}>
          <h2>{tool === "EGRA" ? "Reading bands" : "Average by school"}</h2>
          {tool === "EGRA" ? (
            <table className={styles.table}>
              <thead><tr><th>Band</th><th className={styles.num}>Pupils</th></tr></thead>
              <tbody>
                {bands.map((band) => (
                  <tr key={band}><td>{band}</td><td className={styles.num}>{filtered.filter((point) => point.band === band).length}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <MeanTable points={filtered} field="school" />
          )}
        </section>
      ) : null}

      {tab === "growth" ? <Growth points={filtered} /> : null}

      {tab === "students" ? (
        <section className={styles.card}>
          <h2>Pupils</h2>
          {admin ? (
            <table className={styles.table}>
              <thead><tr><th>Reference</th><th>School</th><th>Grade</th><th>Round</th><th className={styles.num}>Score</th></tr></thead>
              <tbody>
                {filtered.slice(0, 200).map((point) => (
                  <tr key={`${point.studentRef}-${point.tool}-${point.round}`}>
                    <td>{point.studentRef || "—"}</td>
                    <td>{point.school}</td>
                    <td>{point.grade}</td>
                    <td>{point.round}</td>
                    <td className={styles.num}>{point.value ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className={styles.empty}>Sign in as an Academics admin to open pupil references.</p>}
        </section>
      ) : null}
    </main>
  );
}

function MeanTable({ points, field }: { points: AssessmentBoardPoint[]; field: "school" | "grade" }) {
  const names = [...new Set(points.map((point) => point[field]))];
  return (
    <table className={styles.table}>
      <thead><tr><th>{field === "school" ? "School" : "Grade"}</th><th className={styles.num}>Records</th><th className={styles.num}>Average</th></tr></thead>
      <tbody>
        {names.map((name) => {
          const rows = points.filter((point) => point[field] === name);
          const values = rows.map((point) => point.value).filter((value): value is number => value != null);
          return (
            <tr key={name}><td>{name}</td><td className={styles.num}>{rows.length}</td><td className={styles.num}>{mean(values) ?? "—"}</td></tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Growth({ points }: { points: AssessmentBoardPoint[] }) {
  const baseline = points.filter((point) => /base/i.test(point.round));
  const endline = points.filter((point) => /end/i.test(point.round));
  const base = mean(baseline.map((point) => point.value).filter((value): value is number => value != null));
  const end = mean(endline.map((point) => point.value).filter((value): value is number => value != null));
  return (
    <section className={styles.card}>
      <h2>Baseline to endline</h2>
      <p>Averages for the records in the current filter. A round is counted when its name says baseline or endline.</p>
      <section className={styles.tiles}>
        <article className={styles.tile}><span>Baseline</span><strong>{base ?? "—"}</strong></article>
        <article className={styles.tile}><span>Endline</span><strong>{end ?? "—"}</strong></article>
        <article className={styles.tile}><span>Change</span><strong>{base != null && end != null ? Math.round((end - base) * 10) / 10 : "—"}</strong></article>
      </section>
    </section>
  );
}
