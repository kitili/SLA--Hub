"use client";

import { useMemo, useState } from "react";

import { AcademicsHomeLink } from "@/components/BoardChrome";
import styles from "@/components/academics/board.module.css";

export type KgBoardRound = {
  status: "none" | "progress" | "outside" | "complete";
  indexNum: number | null;
  indexLabel: string | null;
  cat: number | null;
  flagged: boolean;
  done: number;
  domainCats: Array<number | null>;
  flagReasons: string[];
};

export type KgBoardStudent = {
  campus: string;
  className: string;
  teacher: string;
  name: string | null;
  rounds: KgBoardRound[];
};

export type KgBoardDevice = {
  teacher: string;
  campus: string;
  className: string;
  lastSeen: string | null;
};

const CATS = [
  { key: "sig", label: "Significant delay" },
  { key: "sl", label: "Slight delay" },
  { key: "avg", label: "Average" },
  { key: "adv1", label: "Slightly advanced" },
  { key: "adv2", label: "Highly advanced" },
];
const COLORS = ["#9a4a0c", "#d99a2b", "#a9afb8", "#5fa8de", "#002368"];

function latestIndex(student: KgBoardStudent): number {
  for (let index = student.rounds.length - 1; index >= 0; index -= 1) {
    if (student.rounds[index]?.status !== "none") return index;
  }
  return 0;
}

function roundOf(student: KgBoardStudent, round: string): KgBoardRound {
  const index = round === "latest" ? latestIndex(student) : Number(round);
  return student.rounds[index] ?? student.rounds[0]!;
}

function counts(rows: KgBoardRound[]): number[] {
  const bins = [0, 0, 0, 0, 0];
  for (const row of rows) {
    if (row.cat != null) bins[row.cat] = (bins[row.cat] ?? 0) + 1;
  }
  return bins;
}

export default function KgBoard({
  students,
  devices,
  campuses,
  classes,
  domains,
  totalItems,
  admin,
  source,
}: {
  students: KgBoardStudent[];
  devices: KgBoardDevice[];
  campuses: string[];
  classes: string[];
  domains: string[];
  totalItems: number;
  admin: boolean;
  source: "live" | "offline" | "empty";
}) {
  const [round, setRound] = useState("latest");
  const [campus, setCampus] = useState("");
  const [className, setClassName] = useState("");
  const [teacher, setTeacher] = useState("");
  const teachers = useMemo(
    () => [...new Set(students.map((student) => student.teacher).filter((name) => name && name !== "—"))].sort(),
    [students],
  );
  const scoped = students.filter((student) =>
    (!campus || student.campus === campus) &&
    (!className || student.className === className) &&
    (!teacher || student.teacher === teacher),
  );
  const picked = scoped.map((student) => ({ student, round: roundOf(student, round) }));
  const complete = picked.filter((row) => row.round.status === "complete");
  const progress = picked.filter((row) => row.round.status === "progress");
  const flagged = complete.filter((row) => row.round.flagged);
  const average = complete.length
    ? Math.round(complete.reduce((sum, row) => sum + (row.round.indexNum ?? 0), 0) / complete.length)
    : null;
  const groups = campus ? classes : campuses;
  const groupOf = (student: KgBoardStudent) => (campus ? student.className : student.campus);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <AcademicsHomeLink className={styles.home}>Academics</AcademicsHomeLink>
        <h1>KG Development Checklist</h1>
        <p>Leadership view of synced kindergarten assessments. Scores use the same age bands and index as the teacher checklist.</p>
      </header>
      {source === "offline" ? <p className={styles.note}>Showing the copy saved on this computer.</p> : null}
      {source === "empty" ? (
        <p className={styles.note}>No checklist records are in the shared database yet. Teacher phones still hold their records until they sync.</p>
      ) : null}
      {!admin ? (
        <p className={styles.note}>Names and follow-up reasons stay with Academics admins. This page shows campus and class totals only.</p>
      ) : null}

      <div className={styles.filters}>
        <label>Round
          <select value={round} onChange={(event) => setRound(event.target.value)}>
            <option value="latest">Latest assessment</option>
            <option value="0">Assessment 1</option>
            <option value="1">Assessment 2</option>
            <option value="2">Assessment 3</option>
          </select>
        </label>
        <label>Campus
          <select value={campus} onChange={(event) => setCampus(event.target.value)}>
            <option value="">All campuses</option>
            {campuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Class
          <select value={className} onChange={(event) => setClassName(event.target.value)}>
            <option value="">All classes</option>
            {classes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Teacher
          <select value={teacher} onChange={(event) => setTeacher(event.target.value)}>
            <option value="">All teachers</option>
            {teachers.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <section className={styles.tiles}>
        <article className={styles.tile}><span>Students on record</span><strong>{scoped.length}</strong></article>
        <article className={styles.tile}><span>Completed</span><strong>{complete.length}</strong></article>
        <article className={styles.tile}><span>In progress</span><strong>{progress.length}</strong></article>
        <article className={styles.tile}><span>Average index</span><strong>{average ?? "—"}</strong></article>
        <article className={styles.tile}><span>To follow up</span><strong>{flagged.length}</strong></article>
      </section>

      <section className={styles.card}>
        <h2>Development Index</h2>
        <p>Share of completed assessments in each band. A finished assessment marks all {totalItems} items.</p>
        <BandTable
          rows={[
            { name: "All", bins: counts(complete.map((row) => row.round)) },
            ...groups.filter(Boolean).map((name) => ({
              name,
              bins: counts(complete.filter((row) => groupOf(row.student) === name).map((row) => row.round)),
            })),
          ]}
        />
      </section>

      <section className={styles.card}>
        <h2>Domains</h2>
        <BandTable
          rows={domains.map((name, index) => ({
            name,
            bins: counts(complete.map((row) => ({
              ...row.round,
              cat: row.round.domainCats[index] ?? null,
            }))),
          }))}
        />
      </section>

      {admin ? (
        <section className={styles.card}>
          <h2>Students to follow up</h2>
          {flagged.length ? (
            <table className={styles.table}>
              <thead><tr><th>Student</th><th>Class</th><th>Index</th><th>Why</th></tr></thead>
              <tbody>
                {flagged.map((row) => (
                  <tr key={`${row.student.name}-${row.student.campus}-${row.student.className}`}>
                    <td>{row.student.name}</td>
                    <td>{row.student.campus} · {row.student.className}</td>
                    <td>{row.round.indexLabel}</td>
                    <td>{row.round.flagReasons.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className={styles.empty}>No students are flagged in this selection.</p>}
        </section>
      ) : null}

      <section className={styles.card}>
        <h2>Teacher sync</h2>
        <p>Each phone that has reached the server. Records stay on the phone until it syncs.</p>
        {devices.length ? (
          <table className={styles.table}>
            <thead><tr><th>Teacher</th><th>Campus</th><th>Class</th><th>Last sync</th></tr></thead>
            <tbody>
              {devices.map((device) => (
                <tr key={`${device.teacher}-${device.campus}-${device.className}`}>
                  <td>{device.teacher}</td>
                  <td>{device.campus}</td>
                  <td>{device.className}</td>
                  <td>{device.lastSeen ? new Date(device.lastSeen).toLocaleString("en-GB") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className={styles.empty}>No phones have synced yet.</p>}
      </section>
    </main>
  );
}

function BandTable({ rows }: { rows: Array<{ name: string; bins: number[] }> }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th></th>
          {CATS.map((cat) => <th key={cat.key} className={styles.num}>{cat.label}</th>)}
          <th>Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const total = row.bins.reduce((sum, count) => sum + count, 0);
          return (
            <tr key={row.name}>
              <td>{row.name}</td>
              {row.bins.map((count, index) => <td key={CATS[index]?.key} className={styles.num}>{count}</td>)}
              <td>
                <span className={styles.bar} aria-hidden="true">
                  {row.bins.map((count, index) => (
                    <i key={CATS[index]?.key} style={{ width: total ? `${(100 * count) / total}%` : 0, background: COLORS[index] }} />
                  ))}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
