"use client";

import { Fragment, useMemo, useState } from "react";

import { safeDocumentUrl } from "@/lib/curriculum-coverage/parse";
import type { buildCoverageModel } from "@/lib/curriculum-coverage/model";

type Model = ReturnType<typeof buildCoverageModel>;
const PAGE = 12;

function DocLink({ href, label }: { href: string; label: string }) {
  const safe = safeDocumentUrl(href);
  if (!safe) return <span className="empty">No link</span>;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

export default function CoverageBoard({ model }: { model: Model }) {
  const [tab, setTab] = useState<"overview" | "lessons" | "assessments">("overview");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState("");
  const [type, setType] = useState("");
  const [setNo, setSetNo] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const subjects = useMemo(() => {
    const names = new Set<string>();
    for (const lesson of model.lessons) names.add(lesson.s);
    for (const copy of model.copies) names.add(copy.subject);
    return [...names].sort();
  }, [model]);
  const types = useMemo(() => [...new Set(model.copies.map((copy) => copy.type))].sort(), [model]);
  const sets = useMemo(() => [...new Set(model.copies.map((copy) => copy.setNo))].sort((a, b) => a - b), [model]);

  const lessons = model.lessons.filter((lesson) => {
    if (grade && lesson.g !== grade) return false;
    if (subject && lesson.s !== subject) return false;
    if (term && lesson.t !== term) return false;
    if (query && !`${lesson.title} ${lesson.g} ${lesson.s} ${lesson.n}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const copies = model.copies.filter((copy) => {
    if (grade && copy.grade !== grade) return false;
    if (subject && copy.subject !== subject) return false;
    if (term && copy.code !== term) return false;
    if (type && copy.type !== type) return false;
    if (setNo && String(copy.setNo) !== setNo) return false;
    if (query && !`${copy.subject} ${copy.grade} ${copy.type} ${copy.folder} ${copy.code}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const rows = tab === "lessons" ? lessons : copies;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safe = Math.min(page, pages - 1);
  const slice = rows.slice(safe * PAGE, (safe + 1) * PAGE);
  const pct = (value: number) => `${Math.round(value)}%`;
  const reset = () => setPage(0);

  const schemeGrades = Object.entries(model.detail).filter(([name, detail]) => {
    if (grade && name !== grade) return false;
    return detail.subjects.some((item) => !subject || item === subject);
  });

  return (
    <div className="cfa">
      <header className="top">
        <div className="htext">
          <span className="hsup">Silverleaf Academy</span>
          <h1>Curriculum dashboard</h1>
        </div>
        <span className="meta">
          {model.lessons.length} lesson rows · {model.copies.length} assessment sets
          {model.generatedAt ? ` · read ${new Date(model.generatedAt).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })}` : ""}
        </span>
      </header>
      <p className="norm-hint">
        A production line is complete only when every subject and term window has a working link.
        Exam-week folder links are not lesson plans. The sheet&apos;s duplicate flag is ignored because each row has its own paper.
        KG1 and KG2 are left out of the TIE percentage.
      </p>
      <div className="modebar">
        <div className="seg big">
          {(["overview", "lessons", "assessments"] as const).map((name) => (
            <button key={name} type="button" className={tab === name ? "on" : ""} onClick={() => { setTab(name); reset(); }}>
              {name === "overview" ? "Overview" : name === "lessons" ? "Lesson plans" : "Assessments"}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <>
          <div className="grid kpis">
            <article className="card kpi"><div className="label">Lesson plans linked</div><div className="num">{model.tot.linked}<span className="of"> / {model.tot.lessons}</span></div><div className="status">{pct(model.tot.lessons ? (model.tot.linked / model.tot.lessons) * 100 : 0)} · {model.tot.placeholders} exam-week placeholders</div></article>
            <article className="card kpi"><div className="label">Schemes of work</div><div className="num">{model.tot.sow}<span className="of"> / {model.tot.sowSlots}</span></div><div className="status">{pct(model.tot.sowSlots ? (model.tot.sow / model.tot.sowSlots) * 100 : 0)} linked</div></article>
            <article className="card kpi"><div className="label">Assessment sets complete</div><div className="num">{model.aTot.complete}<span className="of"> / {model.aTot.total}</span></div><div className="status">{model.aTot.docs} documents · {model.aTot.termly} termly · {model.aTot.sfna} SFNA</div></article>
            <article className="card kpi"><div className="label">Production lines</div><div className="num">{model.totalDone}<span className="of"> / {model.totalApp}</span></div><div className="status">{pct(model.overallPct)} complete</div></article>
          </div>
          <section className="card" style={{ marginTop: 14 }}>
            <h2>Production status by grade</h2>
            <div className="matrix-scroll">
              <table className="matrix">
                <caption>Complete, outstanding, and not-tracked lines from KG1 to Grade 7</caption>
                <thead>
                  <tr>
                    <th className="rowhead">Production line</th>
                    {model.scope.map((item) => <th key={item}>{item}</th>)}
                    <th>% complete</th>
                  </tr>
                </thead>
                <tbody>
                  {model.matrix.map((line) => (
                    <tr key={line.key}>
                      <th className="rowhead">{line.name}<small>{line.done} of {line.app} grades</small></th>
                      {line.cells.map((item) => (
                        <td key={item.grade}>
                          <span className={`cell ${item.state}`} title={item.title}>
                            <b>{item.big}</b>
                            <span>{item.small}</span>
                          </span>
                        </td>
                      ))}
                      <td><b>{pct(line.pct)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12 }}>
              {model.gradeStats.map((item) => (
                <span className="chip" key={item.grade}>{item.grade} {pct(item.pct)}</span>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {tab === "lessons" ? (
        <section className="card" style={{ marginTop: 14 }}>
          <Filters grade={grade} subject={subject} term={term} subjects={subjects} terms={model.terms} labels={model.termLabels} scope={model.scope} query={query} onGrade={(value) => { setGrade(value); reset(); }} onSubject={(value) => { setSubject(value); reset(); }} onTerm={(value) => { setTerm(value); reset(); }} onQuery={(value) => { setQuery(value); reset(); }} />
          <h2>Schemes of work</h2>
          {!schemeGrades.length ? <p className="empty">No schemes match.</p> : (
            <div className="matrix-scroll">
              <table className="matrix">
                <thead>
                  <tr>
                    <th className="rowhead">Subject</th>
                    {model.terms.map((item) => <th key={item}>{model.termLabels[item] || item}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {schemeGrades.map(([name, detail]) => (
                    <Fragment key={name}>
                      <tr><th className="rowhead" colSpan={model.terms.length + 1}>{name}</th></tr>
                      {detail.subjects.filter((item) => !subject || item === subject).map((item) => (
                        <tr key={`${name}-${item}`}>
                          <th className="rowhead">{item}</th>
                          {model.terms.map((termCode) => {
                            const block = detail.blocks[item]?.[termCode];
                            return (
                              <td key={termCode}>
                                {block?.sow ? <DocLink href={block.sow} label="Open scheme" /> : <span className="empty">Not linked</span>}
                                {block ? <div className="count">{block.linked} lessons</div> : null}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h2>Lesson plans</h2>
          <p className="count">{lessons.length} of {model.lessons.length}</p>
          <LessonList rows={lessons.slice(safe * PAGE, (safe + 1) * PAGE)} />
          <Pager page={safe} pages={pages} total={lessons.length} onPage={setPage} />
        </section>
      ) : null}

      {tab === "assessments" ? (
        <section className="card" style={{ marginTop: 14 }}>
          <div className="grid kpis">
            <article className="card kpi"><div className="label">Sets</div><div className="num">{model.aTot.total}</div></article>
            <article className="card kpi"><div className="label">Documents</div><div className="num">{model.aTot.docs}</div><div className="status">papers, schemes, notes</div></article>
            <article className="card kpi"><div className="label">Largest set run</div><div className="num">{model.aTot.maxSets || "—"}</div></article>
          </div>
          <Filters grade={grade} subject={subject} term={term} subjects={subjects} terms={model.terms} labels={model.termLabels} scope={model.scope} query={query} onGrade={(value) => { setGrade(value); reset(); }} onSubject={(value) => { setSubject(value); reset(); }} onTerm={(value) => { setTerm(value); reset(); }} onQuery={(value) => { setQuery(value); reset(); }} />
          <div className="ctrls">
            <select value={type} onChange={(event) => { setType(event.target.value); reset(); }} aria-label="Type">
              <option value="">All types</option>
              {types.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={setNo} onChange={(event) => { setSetNo(event.target.value); reset(); }} aria-label="Set">
              <option value="">All sets</option>
              {sets.map((item) => <option key={item} value={item}>Set {item}</option>)}
            </select>
          </div>
          <p className="count">{copies.length} assessment sets</p>
          {!slice.length ? <p className="empty">Nothing matches.</p> : slice.map((copy) => {
            const row = copy as Model["copies"][number];
            return (
              <div className="cmt" key={`${row.grade}-${row.subject}-${row.code}-${row.setNo}-${row.version}-${row.tree}`}>
                <div className="who"><b>{row.subject}</b> · {row.grade} · {model.termLabels[row.code] || row.code} · Set {row.setNo} of {row.setsHere} · {row.type}</div>
                <DocLink href={row.paper} label="Paper" />
                {" · "}
                <DocLink href={row.scheme} label="Marking scheme" />
                {" · "}
                <DocLink href={row.notes} label="Invigilator notes" />
                {row.folder ? <div className="count">{row.folder}</div> : null}
              </div>
            );
          })}
          <Pager page={safe} pages={pages} total={copies.length} onPage={setPage} />
        </section>
      ) : null}
    </div>
  );
}

function Filters({
  grade, subject, term, subjects, terms, labels, scope, query, onGrade, onSubject, onTerm, onQuery,
}: {
  grade: string;
  subject: string;
  term: string;
  subjects: string[];
  terms: string[];
  labels: Record<string, string>;
  scope: string[];
  query: string;
  onGrade: (value: string) => void;
  onSubject: (value: string) => void;
  onTerm: (value: string) => void;
  onQuery: (value: string) => void;
}) {
  return (
    <div className="ctrls">
      <select value={grade} onChange={(event) => onGrade(event.target.value)} aria-label="Grade">
        <option value="">All grades</option>
        {scope.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={subject} onChange={(event) => onSubject(event.target.value)} aria-label="Subject">
        <option value="">All subjects</option>
        {subjects.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={term} onChange={(event) => onTerm(event.target.value)} aria-label="Term">
        <option value="">All terms</option>
        {terms.map((item) => <option key={item} value={item}>{labels[item] || item}</option>)}
      </select>
      <input type="search" value={query} placeholder="Search" aria-label="Search" onChange={(event) => onQuery(event.target.value)} />
    </div>
  );
}

function LessonList({ rows }: { rows: Model["lessons"] }) {
  if (!rows.length) return <p className="empty">Nothing matches.</p>;
  return rows.map((row) => (
    <div className="cmt" key={`${row.g}-${row.s}-${row.t}-${row.n}-${row.title}`}>
      <div className="who"><b>{row.title}</b> · {row.g} · {row.s} · {row.t}{row.n ? ` · ${row.n}` : ""}</div>
      <DocLink href={row.url} label={row.k === "doc" ? "Open document" : "Open file"} />
    </div>
  ));
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  if (total <= PAGE) return null;
  return (
    <div className="pager">
      <span className="count">{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total}</span>
      <div className="pager-nav">
        <button className="btn" type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="count">Page {page + 1} of {pages}</span>
        <button className="btn" type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
