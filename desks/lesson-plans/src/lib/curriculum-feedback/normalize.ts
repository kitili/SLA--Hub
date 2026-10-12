import type { FeedbackRow, RawCurriculum, RawPd } from "./types";

export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function tidy(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function fold(s: unknown): string {
  return tidy(s).toLowerCase().replace(/[-_/]+/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const SMALL: Record<string, 1> = { of: 1, and: 1, the: 1, our: 1, with: 1, for: 1, to: 1, a: 1, in: 1, on: 1 };
const ACR: Record<string, 1> = { ece: 1, hr: 1, ai: 1, sel: 1, egra: 1, egma: 1, opsp: 1, jdo: 1, ta: 1, ict: 1 };

export function titleCaseName(s: unknown): string {
  const t = tidy(s).replace(/[.,;:)]+$/g, "");
  if (!t) return "—";
  let word = 0;
  return t.toLowerCase().split(/(\s+|-)/).map((part) => {
    if (/^\s+$/.test(part) || part === "-") return part;
    const bare = part.replace(/[^a-z0-9]/g, "");
    if (ACR[bare]) return bare.toUpperCase();
    if (word++ > 0 && SMALL[bare]) return bare;
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join("");
}

export function canonCampus(s: unknown): string {
  const k = fold(s);
  if (!k) return "—";
  if (k === "am" || k === "a m") return "Arusha Modern";
  if (k.includes("arusha") && (k.includes("mod") || k.includes("mord"))) return "Arusha Modern";
  if (k.includes("usa") && k.includes("river")) return "Usa River";
  if (k.includes("ilboru") || k.includes("iliboru")) return "Ilboru";
  if (k === "boma") return "Boma";
  if (k === "kijenge") return "Kijenge";
  if (k === "central") return "Central";
  if (k.includes("arusha town")) return "Arusha Town";
  return titleCaseName(s);
}

export function canonRole(s: unknown): string {
  const k = fold(s);
  if (!k) return "—";
  if (["teacher", "a teacher", "class teacher", "teacher1", "teachers"].includes(k)) return "Teacher";
  if (k === "head teacher" || k === "headteacher") return "Head Teacher";
  if (k.includes("head of school")) return "Head of School";
  if (k.includes("head of section")) return "Head of Section";
  if (k.includes("head of department")) return "Head of Department";
  if (k.includes("head") && k.includes("ece")) return "Head of ECE";
  if (k === "academic head") return "Academic Head";
  if (k === "academic coordinator") return "Academic Coordinator";
  if (k.includes("grade lead")) return "Grade Lead";
  if (k === "school leadership") return "School Leadership";
  if (k === "ta" || k === "teaching assistant") return "Teaching Assistant";
  if (k === "hr") return "HR";
  if (k === "hr assistant") return "HR Assistant";
  return titleCaseName(s);
}

export function canonTopic(s: unknown): string {
  const k = fold(s);
  if (!k) return "—";
  if (k.includes("groth") || k.includes("growth map")) return "Growth map completion";
  if (k.includes("leading our") || k.includes("lead yourself")) return "Leading ourselves";
  if (k.includes("collector") || (k.includes("collect") && (k.includes("assess") || k.includes("asses")))) return "Assessment collector";
  if (k.includes("objective") || k.includes("objetive") || (k.includes("smart") && k.includes("lesson"))) return "Smart objectives";
  if (k.includes("routine") || k.includes("routen")) return "Routines";
  if (k.includes("slide") || k.includes("slade") || (k.includes("claude") && k.includes("ai"))) return "Making slides with AI";
  if (k.includes("health") && k.includes("school")) return "The health of our schools";
  if (k.includes("behav") || k.includes("bahev") || k.includes("behaviour")) return "Behavior tracker";
  if (k.includes("phonic") || k.includes("jolly")) return "Jolly phonics";
  if (k.includes("staff") || k.includes("staf")) return "Staff development and culture";
  if (k.includes("ece") && (k.includes("fund") || k.includes("foundament"))) return "ECE fundamentals";
  if (k.includes("early grade") || k.includes("egra") || k.includes("egma")) return "Early grade assessment";
  if (k.includes("child") && k.includes("learn")) return "How young children learn";
  if (k.includes("radical") || k.includes("candour") || k.includes("candor") || k.includes("condor")) return "Radical candour";
  if (k.includes("watch with care") || k.includes("play with purpose")) return "Play with purpose, watch with care";
  if (k === "sel" || k.includes("social emotional")) return "Social emotional learning";
  if (k.includes("opsp")) return "OPSP working session";
  if (k.includes("drawing")) return "Google Drawing";
  if (k.includes("vital sign")) return "The four vital signs";
  if (k.includes("checkpoint")) return "Midyear checkpoint conversation";
  if (k.includes("result") && k.includes("eval")) return "Result evaluation";
  if (k.includes("mindful")) return "The mindful ways";
  if (k.includes("lead the way")) return "Lead the way";
  return titleCaseName(s);
}

function canonPerson(p: unknown): string {
  let k = tidy(p).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  k = k.replace(/^(mr|mrs|ms|sir|teacher|principal|madam|ht|head teacher)\s+/, "");
  if (!k) return "";
  if (k === "the principal" || k.includes("julius") || k.includes("kimani")) return "Julius Kimani";
  if (k.includes("godfrey") || k.includes("geofrey") || k.includes("godfey") || k.includes("mlokozi") || k.includes("mulokoz")) return "Godfrey Mulokozi";
  if (k.includes("jacqueline") || k.includes("jackline") || k.includes("kamoro") || k.includes("karomo")) return "Jacqueline Karomo";
  if (k.includes("neema")) return "Neema George";
  if (k.includes("austin") || k.includes("oustin")) return "Austin Okechi";
  if (k.includes("nelly")) return "Nelly";
  if (k.includes("henry")) return "Henry";
  if (k.includes("glory")) return "Glory";
  if (k.includes("irene")) return "Irene";
  if (k.includes("immacul") || k.includes("imacc")) return "Immaculate";
  if (k.includes("monica")) return "Monica";
  if (k.includes("pascaline")) return "Pascaline";
  if (k.includes("brenda")) return "Brenda";
  if (k.includes("agness") || k.includes("agnes")) return "Agness";
  if (k.includes("grace")) return "Grace";
  return titleCaseName(p);
}

export function canonFacilitator(s: unknown): string {
  const t = tidy(s);
  if (!t) return "—";
  const names: string[] = [];
  for (const part of t.split(/\s*(?:,|&|\band\b)\s*/i)) {
    const n = canonPerson(part);
    if (n && !names.includes(n)) names.push(n);
  }
  names.sort();
  return names.join(" & ") || "—";
}

export function formatDay(v: unknown): string {
  const t = tidy(v);
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? t;
}

export function canonTool(s: unknown): string {
  const k = fold(s);
  if (!k) return "—";
  if (k.includes("lesson")) return "Lesson Plan";
  if (k.includes("scheme")) return "Scheme of Work";
  return titleCaseName(s);
}

function whenOf(submitted: string | null, received: string | null) {
  const when = submitted || received || "";
  const whenMs = Date.parse(when);
  return { when, whenMs: Number.isFinite(whenMs) ? whenMs : 0 };
}

const emptyPd = {
  topic: "", pd_date: "", facilitator: "",
  relevance: null, confidence: null, impact: null,
  relevance_c: "", confidence_c: "", impact_c: "", applied: "", support_c: "",
};

const emptyCurriculum = {
  tool: "", ref: "",
  strengths: null, gaps: null, usability: null,
  strengths_c: "", gaps_c: "", usability_c: "", overall_c: "",
};

export function presentCurriculum(rows: RawCurriculum[]): FeedbackRow[] {
  return rows.map((r) => ({
    id: String(r.id),
    ...whenOf(r.submitted_at, r.server_received_at),
    teacher: titleCaseName(r.teacher_name),
    campus: canonCampus(r.campus),
    role: canonRole(r.role),
    tool: canonTool(r.tool_type),
    ref: tidy(r.tool_ref),
    strengths: num(r.strengths_rating),
    gaps: num(r.gaps_rating),
    usability: num(r.usability_rating),
    strengths_c: r.strengths_comment || "",
    gaps_c: r.gaps_comment || "",
    usability_c: r.usability_comment || "",
    overall_c: r.overall_comment || "",
    ...emptyPd,
  }));
}

export function presentPd(rows: RawPd[]): FeedbackRow[] {
  return rows.map((r) => ({
    id: String(r.id),
    ...whenOf(r.submitted_at, r.server_received_at),
    teacher: titleCaseName(r.teacher_name),
    campus: canonCampus(r.campus),
    role: canonRole(r.role),
    ...emptyCurriculum,
    topic: canonTopic(r.pd_topic),
    pd_date: formatDay(r.pd_date),
    facilitator: canonFacilitator(r.pd_facilitator),
    relevance: num(r.relevance_rating),
    confidence: num(r.confidence_rating),
    impact: num(r.impact_rating),
    relevance_c: r.relevance_comment || "",
    confidence_c: r.confidence_comment || "",
    impact_c: r.impact_comment || "",
    applied: r.applied_status || "",
    support_c: r.support_needed || "",
  }));
}
