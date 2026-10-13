/**
 * EGRA / EGMA / SEL headline metrics.
 *
 * Matches the live assessment dashboard: one number per record, reading
 * bands for oral fluency, and the legacy Grade 1–3 story-reading correction.
 */

export type AssessmentTool = "EGRA" | "EGMA" | "SEL";

export type AssessmentSubtask = {
  name?: string;
  type?: string;
  metric?: string;
  fluency?: number | null;
  score?: number | null;
  max?: number | null;
  pct?: number | null;
};

export type AssessmentPayload = {
  student_id?: string;
  assessor?: string;
  teacher?: string;
  gender?: string;
  class?: string;
  notes?: string;
  app_version?: string;
  sel_total?: number | string | null;
  sel_max?: number | string | null;
  subtasks?: AssessmentSubtask[];
};

export type AssessmentMetric = {
  value: number | null;
  band: string | null;
};

const ORF_BANDS = [
  { name: "Non-reader (0)", test: (value: number) => value <= 0 },
  { name: "Beginning (1–19)", test: (value: number) => value < 20 },
  { name: "Emerging (20–44)", test: (value: number) => value < 45 },
  { name: "Fluent (45+)", test: () => true },
];

function asNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(number) ? number : null;
}

export function readingBand(value: number): string {
  return ORF_BANDS.find((band) => band.test(value))?.name ?? "Fluent (45+)";
}

export function headlineMetric(tool: string, grade: string, payload: AssessmentPayload): AssessmentMetric {
  if (tool === "SEL") {
    const total = asNumber(payload.sel_total);
    const max = asNumber(payload.sel_max);
    if (total == null || !max) return { value: null, band: null };
    return { value: Math.round((1000 * total) / max) / 10, band: null };
  }

  let subtasks = payload.subtasks ?? [];
  if (tool === "EGRA" && /^G[123]$/.test(grade) && !payload.app_version) {
    subtasks = subtasks.filter((item) => !(item.type === "timed" && /ORAL|PASSAGE|FLUENC/i.test(item.name ?? "")));
  }

  if (tool === "EGRA") {
    const timed = subtasks.filter((item) => item.type === "timed" && item.metric === "CWPM");
    const pick = grade === "KG"
      ? timed.find((item) => /FAMILIAR/i.test(item.name ?? "")) ?? timed[timed.length - 1]
      : timed.find((item) => /ORAL|PASSAGE|FLUENC/i.test(item.name ?? ""));
    const value = pick ? asNumber(pick.fluency) : null;
    return { value, band: value == null ? null : readingBand(value) };
  }

  const timed = subtasks.filter((item) => item.type === "timed");
  const addition = timed.find((item) => /ADDITION/i.test(item.name ?? "")) ?? timed[timed.length - 1];
  return { value: addition ? asNumber(addition.fluency) : null, band: null };
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}
