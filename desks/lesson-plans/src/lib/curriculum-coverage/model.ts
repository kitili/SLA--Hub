import { SCOPE_GRADES, TERM_LABELS, TERMS, TIE_NOT_TRACKED, type AssessmentRow, type Block, type LessonRow, type TieRow } from "./parse";

export type CoveragePayload = {
  generatedAt: string;
  scopeGrades: string[];
  tieNotTracked: string[];
  terms: string[];
  termLabels: Record<string, string>;
  curriculum: {
    grades: Record<string, { subjects: string[]; blocks: Record<string, Record<string, Block>> }>;
    lessons: LessonRow[];
  };
  tie: TieRow[];
  assessments: { copies: AssessmentRow[]; summary: Record<string, string> };
};

export type CellState = "done" | "out" | "na";

export type MatrixCell = {
  grade: string;
  state: CellState;
  big: string;
  small: string;
  title: string;
};

type GradeAssess = {
  total: number;
  complete: number;
  termly: number;
  sfna: number;
  windowCount: number;
  minSets: number;
  maxSets: number;
};

function cell(state: CellState, big = "—", small = "", title = ""): MatrixCell {
  return {
    grade: "",
    state,
    big: state === "done" ? big : "—",
    small: state === "done" ? small : state === "na" ? "Not tracked" : "Outstanding",
    title,
  };
}

export function buildCoverageModel(data: CoveragePayload) {
  const scope = data.scopeGrades.length ? data.scopeGrades : SCOPE_GRADES;
  const terms = data.terms.length ? data.terms : [...TERMS];
  const termLabels = Object.keys(data.termLabels).length ? data.termLabels : TERM_LABELS;
  const grades: Record<string, { subjects: string[]; sow: number; sowSlots: number; lessons: number; linked: number; placeholders: number }> = {};
  for (const [grade, detail] of Object.entries(data.curriculum.grades)) {
    let sow = 0, sowSlots = 0, lessons = 0, linked = 0, placeholders = 0;
    for (const subject of detail.subjects) {
      for (const term of terms) {
        const block = detail.blocks[subject]?.[term];
        if (!block) continue;
        sowSlots++;
        if (block.sow) sow++;
        lessons += block.lessons;
        linked += block.linked;
        placeholders += block.placeholders;
      }
    }
    grades[grade] = { subjects: detail.subjects, sow, sowSlots, lessons, linked, placeholders };
  }
  const tot = Object.values(grades).reduce(
    (sum, grade) => ({
      sow: sum.sow + grade.sow,
      sowSlots: sum.sowSlots + grade.sowSlots,
      lessons: sum.lessons + grade.lessons,
      linked: sum.linked + grade.linked,
      placeholders: sum.placeholders + grade.placeholders,
    }),
    { sow: 0, sowSlots: 0, lessons: 0, linked: 0, placeholders: 0 },
  );

  const copies = data.assessments.copies;
  const aGrades: Record<string, GradeAssess> = {};
  const windows = new Map<string, Map<string, number>>();
  for (const copy of copies) {
    const row = aGrades[copy.grade] || (aGrades[copy.grade] = { total: 0, complete: 0, termly: 0, sfna: 0, windowCount: 0, minSets: 0, maxSets: 0 });
    row.total++;
    if (copy.paper && copy.scheme) row.complete++;
    if (copy.type === "SFNA") row.sfna++;
    else row.termly++;
    const key = [copy.subject, copy.type, copy.code].join("|");
    const gradeWindows = windows.get(copy.grade) || new Map<string, number>();
    gradeWindows.set(key, (gradeWindows.get(key) || 0) + 1);
    windows.set(copy.grade, gradeWindows);
  }
  for (const [grade, counts] of windows) {
    const values = [...counts.values()];
    const row = aGrades[grade];
    if (!row || !values.length) continue;
    row.windowCount = values.length;
    row.minSets = Math.min(...values);
    row.maxSets = Math.max(...values);
  }
  const aTot = copies.reduce(
    (sum, copy) => ({
      total: sum.total + 1,
      complete: sum.complete + (copy.paper && copy.scheme ? 1 : 0),
      termly: sum.termly + (copy.type === "SFNA" ? 0 : 1),
      sfna: sum.sfna + (copy.type === "SFNA" ? 1 : 0),
      papers: sum.papers + (copy.paper ? 1 : 0),
      schemes: sum.schemes + (copy.scheme ? 1 : 0),
      notes: sum.notes + (copy.notes ? 1 : 0),
      maxSets: Math.max(sum.maxSets, copy.setsHere),
    }),
    { total: 0, complete: 0, termly: 0, sfna: 0, papers: 0, schemes: 0, notes: 0, maxSets: 0 },
  );
  const docs = aTot.papers + aTot.schemes + aTot.notes;

  const tie: Record<string, { rows: number; ok: number }> = {};
  for (const row of data.tie) {
    const bucket = tie[row.grade] || (tie[row.grade] = { rows: 0, ok: 0 });
    bucket.rows++;
    if (row.textbooks.length && row.design) bucket.ok++;
  }
  const tieNot = data.tieNotTracked.length ? data.tieNotTracked : TIE_NOT_TRACKED;
  const lines = [
    { key: "sow", name: "Schemes of work", done: (grade: string) => !!grades[grade] && grades[grade].sow > 0 && grades[grade].sow === grades[grade].sowSlots, applicable: () => true },
    { key: "lp", name: "Lesson plans", done: (grade: string) => !!grades[grade] && grades[grade].lessons > 0 && grades[grade].linked === grades[grade].lessons, applicable: () => true },
    { key: "assess", name: "Termly assessments", done: (grade: string) => !!aGrades[grade] && aGrades[grade].complete === aGrades[grade].total && aGrades[grade].total > 0, applicable: () => true },
    { key: "tie", name: "TIE textbooks & designs", done: (grade: string) => !!tie[grade] && tie[grade].ok === tie[grade].rows && tie[grade].rows > 0, applicable: (grade: string) => !tieNot.includes(grade) },
  ];
  const lineStats = lines.map((line) => {
    const applicable = scope.filter(line.applicable);
    const done = applicable.filter(line.done);
    return { key: line.key, name: line.name, app: applicable.length, done: done.length, pct: applicable.length ? (done.length / applicable.length) * 100 : 0 };
  });
  const gradeStats = scope.map((grade) => {
    const applicable = lines.filter((line) => line.applicable(grade));
    const done = applicable.filter((line) => line.done(grade));
    return { grade, app: applicable.length, done: done.length, pct: applicable.length ? (done.length / applicable.length) * 100 : 0 };
  });
  const totalApp = lineStats.reduce((sum, line) => sum + line.app, 0);
  const totalDone = lineStats.reduce((sum, line) => sum + line.done, 0);

  const matrix = lines.map((line) => {
    const stat = lineStats.find((item) => item.key === line.key)!;
    const cells = scope.map((grade) => {
      if (!line.applicable(grade)) return { ...cell("na", "", "", `${grade}: not tracked`), grade };
      if (line.key === "sow") {
        const row = grades[grade];
        if (!row) return { ...cell("out", "", "", `${grade}: no scheme indexed`), grade };
        const state: CellState = line.done(grade) ? "done" : "out";
        return { ...cell(state, String(row.sow), `${row.subjects.length} subjects`, `${grade}: ${row.sow} of ${row.sowSlots} schemes linked`), grade };
      }
      if (line.key === "lp") {
        const row = grades[grade];
        if (!row) return { ...cell("out", "", "", `${grade}: no lessons indexed`), grade };
        const state: CellState = line.done(grade) ? "done" : "out";
        const small = row.linked === row.lessons ? "all linked" : `${row.lessons - row.linked} unlinked`;
        return { ...cell(state, String(row.linked), small, `${grade}: ${row.linked} of ${row.lessons} lessons linked`), grade };
      }
      if (line.key === "assess") {
        const row = aGrades[grade];
        if (!row) return { ...cell("out", "", "", `${grade}: no assessments indexed`), grade };
        const state: CellState = line.done(grade) ? "done" : "out";
        const sets = row.minSets === row.maxSets ? `${row.minSets} sets each` : `${row.minSets}–${row.maxSets} sets each`;
        return { ...cell(state, String(row.total), sets, `${grade}: ${row.complete} of ${row.total} complete`), grade };
      }
      const row = tie[grade];
      if (!row) return { ...cell("out", "", "", `${grade}: no TIE rows`), grade };
      const state: CellState = line.done(grade) ? "done" : "out";
      return { ...cell(state, `${row.ok}/${row.rows}`, "subjects linked", `${grade}: ${row.ok} of ${row.rows} subjects have both links`), grade };
    });
    return { ...stat, cells };
  });

  return {
    scope,
    terms,
    termLabels,
    grades,
    detail: data.curriculum.grades,
    tot,
    lessons: data.curriculum.lessons,
    copies,
    aGrades,
    aTot: { ...aTot, docs },
    tie,
    tieNot,
    lineStats,
    gradeStats,
    matrix,
    totalApp,
    totalDone,
    overallPct: totalApp ? (totalDone / totalApp) * 100 : 0,
    summary: data.assessments.summary,
    generatedAt: data.generatedAt,
  };
}
