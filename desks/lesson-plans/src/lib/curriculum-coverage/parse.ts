import { canonGrade, canonSubject, canonTerm, canonType } from "./canon";

export const TERMS = ["T1A", "T1B", "T2A", "T2B"] as const;
export const TERM_LABELS: Record<string, string> = {
  T1A: "Term 1A",
  T1B: "Term 1B",
  T2A: "Term 2A",
  T2B: "Term 2B",
};
export const SCOPE_GRADES = ["KG1", "KG2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
export const TIE_NOT_TRACKED = ["KG1", "KG2"];

export type Block = { sow: string; lessons: number; linked: number; placeholders: number; unlinked: number };
export type LessonRow = { g: string; s: string; t: string; n: string; title: string; url: string; k: string };
export type TieRow = { grade: string; subject: string; textbooks: string[]; design: string };
export type AssessmentRow = {
  grade: string;
  type: string;
  subject: string;
  term: string;
  code: string;
  version: string;
  paper: string;
  scheme: string;
  notes: string;
  tree: string;
  folder: string;
  path: string;
  setNo: number;
  setsHere: number;
};

const SUMMARY_SKIP = new Set([
  "unique assessments",
  "of which termly",
  "of which sfna",
  "total copies indexed (incl. duplicates)",
  "duplicate copies",
  "versions per assessment",
]);

export function gradeFromSheetName(name: string) {
  const match = /^\s*(KG\s*(\d)|GRADE\s*(\d))/i.exec(name);
  if (!match) return null;
  return canonGrade(match[2] ? `KG${match[2]}` : `Grade ${match[3]}`);
}

export function hyperlinkFromFormula(formula: string) {
  if (!formula) return "";
  const match = /^=\s*HYPERLINK\(\s*"([^"]+)"/i.exec(formula);
  return match?.[1] ?? "";
}

/** Only https document links are opened. Sheet text cannot inject a script URL. */
export function safeDocumentUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function linkKind(url: string) {
  if (/\/folders\//.test(url)) return "folder";
  if (/\/document\/d\//.test(url)) return "doc";
  return "file";
}

const HEADER_TERM = /\b(?:TERM\s*)?T?\s*([12])\s*([AB])\s*$/i;

export function parseCurriculumGrid(sheetName: string, vals: string[][], forms: string[][], links: string[][]) {
  const grade = gradeFromSheetName(sheetName);
  if (!grade) return null;
  const headerRows: number[] = [];
  for (let r = 0; r < vals.length; r++) {
    const label = vals[r]?.[0];
    if (typeof label === "string" && HEADER_TERM.test(label)) headerRows.push(r);
  }
  const subjects: string[] = [];
  const seen = new Set<string>();
  const blocks: Record<string, Record<string, Block>> = {};
  const lessons: LessonRow[] = [];

  headerRows.forEach((h, i) => {
    const nextHeader = headerRows[i + 1];
    const end = nextHeader == null ? vals.length - 1 : nextHeader - 1;
    for (let c = 0; c < (vals[h]?.length || 0); c++) {
      const cellText = vals[h]?.[c] || "";
      const match = HEADER_TERM.exec(cellText);
      if (!match) continue;
      const term = `T${match[1]}${match[2]}`.toUpperCase();
      const rawName = cellText.replace(HEADER_TERM, "").trim();
      const name = canonSubject(rawName);
      if (!name) continue;
      if (!seen.has(name)) {
        seen.add(name);
        subjects.push(name);
      }
      blocks[name] = blocks[name] || {};
      const slot = blocks[name][term] || (blocks[name][term] = { sow: "", lessons: 0, linked: 0, placeholders: 0, unlinked: 0 });
      for (let r2 = h + 2; r2 <= end; r2++) {
        const row = vals[r2];
        if (!row) continue;
        const sowLink = links[r2]?.[c] || "";
        if (sowLink && !slot.sow) slot.sow = sowLink;
        const title = row[c + 2];
        if (title == null || String(title).trim() === "") continue;
        const formula = forms[r2]?.[c + 2] || "";
        if (formula && !/^=\s*HYPERLINK/i.test(formula)) continue;
        const url = links[r2]?.[c + 2] || "";
        const num = String(row[c + 1] || "").trim();
        if (url) {
          const kind = linkKind(url);
          if (kind === "folder") {
            slot.placeholders++;
            continue;
          }
          slot.lessons++;
          slot.linked++;
          lessons.push({ g: grade, s: name, t: term, n: num, title: String(title).trim(), url, k: kind });
        } else {
          slot.lessons++;
          slot.unlinked++;
          lessons.push({ g: grade, s: name, t: term, n: num, title: String(title).trim(), url: "", k: "none" });
        }
      }
    }
  });
  return { grade, subjects, blocks, lessons };
}

export function parseTieGrid(vals: string[][], links: string[][]): TieRow[] {
  const out: TieRow[] = [];
  for (let r = 1; r < vals.length; r++) {
    const grade = canonGrade(String(vals[r]?.[0] || ""));
    const subject = canonSubject(String(vals[r]?.[1] || ""));
    if (!grade || !subject) continue;
    const textbooks = [links[r]?.[2], links[r]?.[3]].filter((url): url is string => Boolean(url));
    out.push({ grade, subject, textbooks, design: links[r]?.[4] || "" });
  }
  return out;
}

export function numberSets(copies: Omit<AssessmentRow, "setNo" | "setsHere">[]): AssessmentRow[] {
  const treeOrder = new Map<string, number>();
  for (const copy of copies) {
    if (!treeOrder.has(copy.tree)) treeOrder.set(copy.tree, treeOrder.size);
  }
  const groups = new Map<string, typeof copies>();
  for (const copy of copies) {
    const key = [copy.grade, copy.type, copy.subject, copy.code].join("\u0000");
    const list = groups.get(key) || [];
    list.push(copy);
    groups.set(key, list);
  }
  const out: AssessmentRow[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const order = (treeOrder.get(a.tree) || 0) - (treeOrder.get(b.tree) || 0);
      if (order) return order;
      return a.version < b.version ? -1 : a.version > b.version ? 1 : 0;
    });
    group.forEach((copy, index) => out.push({ ...copy, setNo: index + 1, setsHere: group.length }));
  }
  return out;
}

export function parseAssessmentCopies(vals: string[][], forms: string[][], links: string[][]) {
  const headerRow = vals[0];
  if (!headerRow) return [];
  const header = headerRow.map((cell) => String(cell).trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const ci = {
    grade: col("Grade"),
    type: col("Type"),
    subject: col("Subject"),
    term: col("Term"),
    code: col("Term Code"),
    version: col("Version"),
    paper: col("Paper"),
    scheme: col("Marking Scheme"),
    notes: col("Invigilator Notes"),
    tree: col("Source Tree"),
    folder: col("Source Folder"),
    path: col("Full Path"),
  };
  const rows: Omit<AssessmentRow, "setNo" | "setsHere">[] = [];
  for (let r = 1; r < vals.length; r++) {
    const row = vals[r] || [];
    const grade = ci.grade >= 0 ? canonGrade(String(row[ci.grade] || "")) : "";
    if (!grade) continue;
    const link = (index: number) => (index >= 0 ? links[r]?.[index] || hyperlinkFromFormula(forms[r]?.[index] || "") : "");
    const val = (index: number) => (index >= 0 ? String(row[index] || "").trim() : "");
    const code = canonTerm(val(ci.code) || val(ci.term));
    rows.push({
      grade,
      type: canonType(val(ci.type)),
      subject: canonSubject(val(ci.subject)),
      term: val(ci.term),
      code,
      version: val(ci.version),
      paper: link(ci.paper),
      scheme: link(ci.scheme),
      notes: link(ci.notes),
      tree: val(ci.tree),
      folder: val(ci.folder),
      path: val(ci.path),
    });
  }
  return numberSets(rows);
}

export function parseSummary(vals: string[][]) {
  const out: Record<string, string> = {};
  for (const row of vals) {
    const key = String(row[0] || "").trim();
    const value = row[1];
    if (!key || value == null || value === "") continue;
    if (SUMMARY_SKIP.has(key.toLowerCase())) continue;
    out[key] = String(value).trim();
  }
  return out;
}
