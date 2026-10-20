export type HubHandoff = {
  id: string;
  from: string;
  title: string;
  summary: string;
  facts: Array<{ label: string; value: string }>;
};

export async function readHubHandoffs(to: string): Promise<HubHandoff[]> {
  const key = process.env.HUB_API_KEY?.trim();
  if (!key) return [];
  const base = (process.env.HUB_API_URL || "https://hub.silverleaf.co.tz").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${base}/api/v1/bridge?to=${encodeURIComponent(to)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { handoffs?: HubHandoff[] };
    return Array.isArray(body.handoffs) ? body.handoffs : [];
  } catch (error) {
    console.error("[hub-bridge]", error instanceof Error ? error.name : "error");
    return [];
  } finally {
    clearTimeout(timer);
  }
}
