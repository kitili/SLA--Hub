const HUB_URL = (process.env.HUB_API_URL || "https://hub.silverleaf.co.tz").replace(/\/$/, "");

function hubKey(): string | null {
  const key = process.env.HUB_API_KEY?.trim();
  return key || null;
}

export async function publishTrainingInsights(
  overview: Array<{
    courseName?: string;
    batchName?: string;
    enrolled?: number;
    completedCount?: number;
    completionPercentage?: number;
  }>,
): Promise<void> {
  const key = hubKey();
  if (!key || !overview.length) return;
  const courses = overview.slice(0, 40).map((row) => ({
    courseName: row.courseName ?? "Course",
    batchName: row.batchName ?? "",
    enrolled: row.enrolled ?? 0,
    completedCount: row.completedCount ?? 0,
    completionPercentage: row.completionPercentage ?? null,
  }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`${HUB_URL}/api/v1/links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        kind: "talent.training",
        source: "talent-academy",
        mode: "replace",
        summary: `${courses.length} courses with completion from Talent Academy`,
        payload: { courses, reportedAt: new Date().toISOString() },
      }),
    });
  } catch (error) {
    console.error("[talent-hub]", error instanceof Error ? error.name : "error");
  } finally {
    clearTimeout(timer);
  }
}

export async function readDeskBridge(): Promise<
  Array<{ id: string; from: string; title: string; summary: string; facts: Array<{ label: string; value: string }> }>
> {
  const key = hubKey();
  if (!key) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${HUB_URL}/api/v1/bridge?to=talent-academy`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const body = (await response.json()) as {
      handoffs?: Array<{ id: string; from: string; title: string; summary: string; facts?: Array<{ label: string; value: string }> }>;
    };
    return (body.handoffs ?? []).map((row) => ({
      id: row.id,
      from: row.from,
      title: row.title,
      summary: row.summary,
      facts: row.facts ?? [],
    }));
  } catch (error) {
    console.error("[talent-hub]", error instanceof Error ? error.name : "error");
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function readPdInsights(): Promise<
  Array<{
    topic: string;
    campus: string;
    count: number;
    relevance: number | null;
    confidence: number | null;
    impact: number | null;
  }>
> {
  const key = hubKey();
  if (!key) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${HUB_URL}/api/v1/links?kind=academics.pd`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const body = (await response.json()) as {
      data?: Array<{ payload?: { topics?: unknown } }>;
    };
    const topics = body.data?.[0]?.payload?.topics;
    if (!Array.isArray(topics)) return [];
    return topics.slice(0, 12).map((item) => {
      const row = item as Record<string, unknown>;
      return {
        topic: String(row.topic ?? "Topic"),
        campus: String(row.campus ?? ""),
        count: Number(row.count ?? 0),
        relevance: typeof row.relevance === "number" ? row.relevance : null,
        confidence: typeof row.confidence === "number" ? row.confidence : null,
        impact: typeof row.impact === "number" ? row.impact : null,
      };
    });
  } catch (error) {
    console.error("[talent-hub]", error instanceof Error ? error.name : "error");
    return [];
  } finally {
    clearTimeout(timer);
  }
}
