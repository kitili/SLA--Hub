import "server-only";

import type { FeedbackRow } from "@/lib/curriculum-feedback/types";

const HUB_URL = (process.env.HUB_API_URL || "https://hub.silverleaf.co.tz").replace(/\/$/, "");

type PdInsight = {
  topic: string;
  campus: string;
  count: number;
  relevance: number | null;
  confidence: number | null;
  impact: number | null;
  applied: number;
};

function mean(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number");
  if (!nums.length) return null;
  return Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 10) / 10;
}

export function pdInsights(rows: FeedbackRow[]): PdInsight[] {
  const groups = new Map<string, FeedbackRow[]>();
  for (const row of rows) {
    const topic = row.topic.trim() || "Untitled";
    const campus = row.campus.trim() || "Unstated";
    const key = `${topic}::${campus}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([, list]) => ({
      topic: list[0]?.topic.trim() || "Untitled",
      campus: list[0]?.campus.trim() || "Unstated",
      count: list.length,
      relevance: mean(list.map((row) => row.relevance)),
      confidence: mean(list.map((row) => row.confidence)),
      impact: mean(list.map((row) => row.impact)),
      applied: list.filter((row) => row.applied.trim().toLowerCase() === "yes").length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
}

async function hubFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const key = process.env.HUB_API_KEY?.trim();
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    return await fetch(`${HUB_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    console.error("[academics-hub]", error instanceof Error ? error.name : "error");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function publishPdInsights(rows: FeedbackRow[]): Promise<void> {
  const topics = pdInsights(rows);
  if (!topics.length) return;
  await hubFetch("/api/v1/links", {
    method: "POST",
    body: JSON.stringify({
      kind: "academics.pd",
      source: "academics",
      mode: "replace",
      summary: `${topics.length} professional-development topics from Academics`,
      payload: { topics, reportedAt: new Date().toISOString() },
    }),
  });
}

export type TrainingInsight = {
  courseName: string;
  batchName: string;
  enrolled: number;
  completedCount: number;
  completionPercentage: number | null;
};

export async function readDeskBridge(): Promise<Array<{ id: string; from: string; title: string; facts: Array<{ label: string; value: string }> }>> {
  const response = await hubFetch("/api/v1/bridge?to=lesson-plans");
  if (!response?.ok) return [];
  const body = (await response.json()) as {
    handoffs?: Array<{ id: string; from: string; title: string; facts?: Array<{ label: string; value: string }> }>;
  };
  return (body.handoffs ?? []).map((row) => ({
    id: row.id,
    from: row.from,
    title: row.title,
    facts: row.facts ?? [],
  }));
}

export async function readTrainingInsights(): Promise<TrainingInsight[]> {
  const response = await hubFetch("/api/v1/links?kind=talent.training");
  if (!response?.ok) return [];
  const body = (await response.json()) as { data?: Array<{ payload?: { courses?: unknown } }> };
  const courses = body.data?.[0]?.payload?.courses;
  if (!Array.isArray(courses)) return [];
  return courses
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        courseName: String(row.courseName ?? "Course"),
        batchName: String(row.batchName ?? ""),
        enrolled: Number(row.enrolled ?? 0),
        completedCount: Number(row.completedCount ?? 0),
        completionPercentage:
          typeof row.completionPercentage === "number" ? row.completionPercentage : null,
      };
    })
    .slice(0, 12);
}
