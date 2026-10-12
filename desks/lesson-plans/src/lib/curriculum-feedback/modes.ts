import type { FeedbackRow, Series, SeriesKey } from "./types";

export type FilterDef = { field: keyof FeedbackRow; all: string; label: string };
export type CommentDef = { dim: string; field: keyof FeedbackRow; tag: string; hex: string };

export type Mode = {
  key: "curriculum" | "pd";
  subtitle: string;
  footer: string;
  noun: string;
  reportTitle: string;
  series: Series[];
  groupField: keyof FeedbackRow;
  groupTitle: string;
  groupHint: string;
  filters: FilterDef[];
  segDims: { label: string; val: keyof FeedbackRow }[];
  measures: { label: string; val: string }[];
  applied: boolean;
  priorityKey: (r: FeedbackRow) => string;
  priorityHead: string;
  priorityCols: string[];
  priorityHint: string;
  priorityLabel: (p: string[]) => { main: string; sub: string };
  comments: CommentDef[];
  csvCols: (keyof FeedbackRow)[];
  csvName: string;
};

const curriculumSeries: Series[] = [
  { key: "strengths", label: "Strengths", color: "var(--s1)", hex: "#2f6bd6" },
  { key: "gaps", label: "Completeness", color: "var(--s2)", hex: "#cf9310" },
  { key: "usability", label: "Usability", color: "var(--s3)", hex: "#5fb3e8" },
];

const pdSeries: Series[] = [
  { key: "relevance", label: "Relevance", color: "var(--s1)", hex: "#2f6bd6" },
  { key: "confidence", label: "Confidence", color: "var(--s2)", hex: "#cf9310" },
  { key: "impact", label: "Classroom impact", color: "var(--s3)", hex: "#5fb3e8" },
];

export const MODES: Record<"curriculum" | "pd", Mode> = {
  curriculum: {
    key: "curriculum",
    subtitle: "Curriculum Feedback — Analysis",
    footer: "Silverleaf Academy · Curriculum feedback analysis",
    noun: "tool",
    reportTitle: "Curriculum tool feedback",
    series: curriculumSeries,
    groupField: "tool",
    groupTitle: "How each tool is landing",
    groupHint: "Average score (1–5) per area, lowest overall on the left. Click a group to filter.",
    filters: [
      { field: "tool", all: "All tools", label: "Tool" },
      { field: "campus", all: "All campuses", label: "Campus" },
      { field: "role", all: "All roles", label: "Role" },
    ],
    segDims: [
      { label: "Campus", val: "campus" },
      { label: "Role", val: "role" },
      { label: "Teacher", val: "teacher" },
    ],
    measures: [
      { label: "Overall", val: "overall" },
      { label: "Strengths", val: "strengths" },
      { label: "Completeness", val: "gaps" },
      { label: "Usability", val: "usability" },
    ],
    applied: false,
    priorityKey: (r) => `${r.tool} ‖ ${r.campus} ‖ ${r.role}`,
    priorityHead: "Tool · Campus · Role",
    priorityCols: ["Str", "Cmp", "Use"],
    priorityHint: "Tool + campus + role combinations scoring lowest (with 2+ responses). Click a row to filter.",
    priorityLabel: (p) => ({ main: p[0] ?? "", sub: `${p[1] ?? ""} · ${p[2] ?? ""}` }),
    comments: [
      { dim: "strengths", field: "strengths_c", tag: "Strength", hex: "#2f6bd6" },
      { dim: "gaps", field: "gaps_c", tag: "Gap", hex: "#b07d0d" },
      { dim: "usability", field: "usability_c", tag: "Usability", hex: "#2f8fce" },
      { dim: "overall", field: "overall_c", tag: "Other", hex: "#4a5568" },
    ],
    csvCols: ["when", "teacher", "campus", "role", "tool", "ref", "strengths", "strengths_c", "gaps", "gaps_c", "usability", "usability_c", "overall_c"],
    csvName: "silverleaf-curriculum-feedback.csv",
  },
  pd: {
    key: "pd",
    subtitle: "PD Impact — Analysis",
    footer: "Silverleaf Academy · Professional development impact",
    noun: "session",
    reportTitle: "PD impact feedback",
    series: pdSeries,
    groupField: "topic",
    groupTitle: "How each session is landing",
    groupHint: "Average score (1–5) per area, by PD session, lowest overall on the left. Click a group to filter.",
    filters: [
      { field: "topic", all: "All sessions", label: "Session" },
      { field: "facilitator", all: "All facilitators", label: "Facilitator" },
      { field: "campus", all: "All campuses", label: "Campus" },
    ],
    segDims: [
      { label: "Session", val: "topic" },
      { label: "Facilitator", val: "facilitator" },
      { label: "Campus", val: "campus" },
      { label: "Role", val: "role" },
    ],
    measures: [
      { label: "Overall", val: "overall" },
      { label: "Relevance", val: "relevance" },
      { label: "Confidence", val: "confidence" },
      { label: "Impact", val: "impact" },
    ],
    applied: true,
    priorityKey: (r) => `${r.topic} ‖ ${r.facilitator}`,
    priorityHead: "Session · Facilitator",
    priorityCols: ["Rel", "Cnf", "Imp"],
    priorityHint: "PD sessions scoring lowest (with 2+ responses). Click a row to filter.",
    priorityLabel: (p) => ({ main: p[0] ?? "", sub: p[1] && p[1] !== "—" ? `Facilitator: ${p[1]}` : "" }),
    comments: [
      { dim: "relevance", field: "relevance_c", tag: "Relevance", hex: "#2f6bd6" },
      { dim: "confidence", field: "confidence_c", tag: "Confidence", hex: "#b07d0d" },
      { dim: "impact", field: "impact_c", tag: "Impact", hex: "#2f8fce" },
      { dim: "support", field: "support_c", tag: "Support asked", hex: "#4a5568" },
    ],
    csvCols: ["when", "teacher", "campus", "role", "topic", "pd_date", "facilitator", "relevance", "relevance_c", "confidence", "confidence_c", "impact", "impact_c", "applied", "support_c"],
    csvName: "silverleaf-pd-impact.csv",
  },
};

export type ModeKey = keyof typeof MODES;
export type Measure = "overall" | SeriesKey;
