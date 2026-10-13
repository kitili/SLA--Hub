/**
 * KG Development Checklist scoring.
 *
 * Same rules as the teacher app and the leadership dashboard: age band,
 * scaled scores 1–19, and the Development Index. Item text stays in the
 * rubric file; this module only turns a synced record into bands.
 */
import rubric from "./rubric.json";

export const KG_CATS = [
  { key: "sig", label: "Significant delay" },
  { key: "sl", label: "Slight delay" },
  { key: "avg", label: "Average" },
  { key: "adv1", label: "Slightly advanced" },
  { key: "adv2", label: "Highly advanced" },
] as const;

type RubricItem = { n: number };
type RubricDomain = { key: string; name: string; items: RubricItem[] };

export const KG_DOMAINS = rubric.domains as RubricDomain[];
export const KG_CAMPUSES = rubric.campuses as string[];
export const KG_CLASSES = rubric.classes as string[];
export const TOTAL_ITEMS = KG_DOMAINS.reduce((sum, domain) => sum + domain.items.length, 0);

const SCALED = rubric.scaled as Record<string, Record<string, Record<string, number>>>;
const STANDARD = rubric.standard as Record<string, number>;

export type RoundStatus = "none" | "progress" | "outside" | "complete";

export type KgPayload = {
  name?: string;
  campus?: string;
  class?: string;
  sex?: string;
  dob?: string;
  admission?: string;
  assessments?: Record<string, { date?: string; examiner?: string } | undefined>;
  marks?: Record<string, Record<string, string> | undefined>;
  notes?: Record<string, unknown>;
};

export type ScoredRound = {
  status: RoundStatus;
  date: string | null;
  done: number;
  band: "A" | "B" | "C" | null;
  indexNum: number | null;
  indexLabel: string | null;
  cat: number | null;
  flagged: boolean;
  flagReasons: string[];
  domainCats: Array<number | null>;
};

export function ageMonths(dob: string | undefined, test: string | undefined): number | null {
  if (!dob || !test) return null;
  const born = new Date(dob);
  const assessed = new Date(test);
  if (Number.isNaN(born.getTime()) || Number.isNaN(assessed.getTime()) || assessed < born) return null;
  let months = (assessed.getFullYear() - born.getFullYear()) * 12 + (assessed.getMonth() - born.getMonth());
  if (assessed.getDate() < born.getDate()) months -= 1;
  return months;
}

export function bandOf(months: number): "A" | "B" | "C" | null {
  if (months >= 37 && months <= 48) return "A";
  if (months >= 49 && months <= 60) return "B";
  if (months >= 61 && months <= 71) return "C";
  return null;
}

export function catScaled(score: number): number {
  if (score <= 3) return 0;
  if (score <= 6) return 1;
  if (score <= 13) return 2;
  if (score <= 16) return 3;
  return 4;
}

export function catIndex(value: number): number {
  if (value <= 69) return 0;
  if (value <= 79) return 1;
  if (value <= 119) return 2;
  if (value <= 129) return 3;
  return 4;
}

function scaledOf(band: "A" | "B" | "C", domain: string, raw: number): number | null {
  const table = SCALED[band]?.[domain];
  const value = table?.[String(raw)];
  return value === undefined ? null : value;
}

export function scoreRound(payload: KgPayload, round: number): ScoredRound {
  const assessment = payload.assessments?.[String(round)];
  const empty: ScoredRound = {
    status: "none",
    date: null,
    done: 0,
    band: null,
    indexNum: null,
    indexLabel: null,
    cat: null,
    flagged: false,
    flagReasons: [],
    domainCats: KG_DOMAINS.map(() => null),
  };
  if (!assessment?.date) return empty;

  const marks = payload.marks?.[String(round)] ?? {};
  let done = 0;
  const raws = KG_DOMAINS.map((domain) => {
    let raw = 0;
    for (const item of domain.items) {
      const mark = marks[`${domain.key}.${item.n}`];
      if (mark === "y") raw += 1;
      if (mark === "y" || mark === "n") done += 1;
    }
    return raw;
  });

  const months = ageMonths(payload.dob, assessment.date);
  const band = months == null ? null : bandOf(months);
  const base = { ...empty, date: assessment.date, done };
  if (done < TOTAL_ITEMS) return { ...base, status: "progress" };
  if (!band) return { ...base, status: "outside" };

  let sum = 0;
  const domainCats = raws.map((raw, index) => {
    const domain = KG_DOMAINS[index];
    if (!domain) return null;
    const scaled = scaledOf(band, domain.key, raw);
    if (scaled == null) return null;
    sum += scaled;
    return catScaled(scaled);
  });
  if (domainCats.some((cat) => cat == null)) return { ...base, status: "outside", domainCats };

  let indexNum: number;
  let indexLabel: string;
  let cat: number;
  if (sum < 29) {
    indexNum = 36;
    indexLabel = "<37";
    cat = 0;
  } else if (sum > 98) {
    indexNum = 139;
    indexLabel = ">138";
    cat = 4;
  } else {
    indexNum = STANDARD[String(sum)] ?? sum;
    indexLabel = String(indexNum);
    cat = catIndex(indexNum);
  }

  const flagReasons: string[] = [];
  if (cat <= 1) flagReasons.push(`Development Index ${indexLabel} (${KG_CATS[cat]?.label.toLowerCase()})`);
  const delayed = KG_DOMAINS.filter((_, index) => domainCats[index] === 0).map((domain) => domain.name);
  if (delayed.length) flagReasons.push(`Significant delay in ${delayed.join(", ")}`);

  return {
    status: "complete",
    date: assessment.date,
    done,
    band,
    indexNum,
    indexLabel,
    cat,
    flagged: flagReasons.length > 0,
    flagReasons,
    domainCats,
  };
}

export function latestRound(payload: KgPayload): number {
  for (let round = 2; round >= 0; round -= 1) {
    if (payload.assessments?.[String(round)]?.date) return round;
  }
  return 0;
}
