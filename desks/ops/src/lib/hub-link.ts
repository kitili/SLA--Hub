const HUB_URL = (process.env.HUB_API_URL || "https://hub.silverleaf.co.tz").replace(/\/$/, "");

export async function publishBehaviourHistory(
  reports: Array<{
    id: string;
    tripId: string;
    severity: string;
    notes: string | null;
    occurredAt: string | null;
  }>,
): Promise<void> {
  const key = process.env.HUB_API_KEY?.trim();
  if (!key || reports.length === 0) return;
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
        kind: "ops.behaviour",
        source: "ops-history",
        mode: "replace",
        summary: `${reports.length} behaviour reports already on file`,
        payload: {
          reports: reports.slice(0, 40).map((report) => ({
            id: report.id,
            tripId: report.tripId,
            severity: report.severity,
            notes: (report.notes ?? "").slice(0, 1000),
            occurredAt: report.occurredAt,
            setting: "bus",
          })),
        },
      }),
    });
  } catch (error) {
    console.error("[ops-hub]", error instanceof Error ? error.name : "error");
  } finally {
    clearTimeout(timer);
  }
}

export async function sendBehaviourToStudentExperience(report: {
  tripId: string;
  severity: string;
  notes: string | null;
  occurredAt: string | null;
  late: boolean;
}): Promise<void> {
  const key = process.env.HUB_API_KEY?.trim();
  if (!key) return;

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
        kind: "ops.behaviour",
        source: "ops",
        mode: "append",
        summary: `${report.severity} behaviour report from the matron`,
        payload: {
          tripId: report.tripId,
          severity: report.severity,
          notes: (report.notes ?? "").slice(0, 1000),
          occurredAt: report.occurredAt,
          late: report.late,
          setting: "bus",
        },
      }),
    });
  } catch (error) {
    console.error("[ops-hub]", error instanceof Error ? error.name : "error");
  } finally {
    clearTimeout(timer);
  }
}
