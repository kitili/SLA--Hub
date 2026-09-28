import { VisitRecord } from "@/domain/Visit";
import type { VisitSource } from "@/domain/types";

export async function fetchVisits(params: {
  campus?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  onSite?: boolean;
  signedOut?: boolean;
  source?: VisitSource;
}): Promise<VisitRecord[]> {
  const query = new URLSearchParams();
  if (params.campus) query.set("campus", params.campus);
  if (params.date) query.set("date", params.date);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.onSite) query.set("onSite", "1");
  if (params.signedOut) query.set("signedOut", "1");
  if (params.source) query.set("source", params.source);
  const response = await fetch(`/api/visits?${query.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as { visits?: VisitRecord[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Could not load visits.");
  }
  return payload.visits ?? [];
}

export async function createVisit(input: {
  name: string;
  phone: string;
  purpose: string;
  host: string;
  campus: string;
  photo?: string | null;
  source: "desk" | "self";
}): Promise<VisitRecord> {
  const response = await fetch("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { visit?: VisitRecord; error?: string };
  if (!response.ok || !payload.visit) {
    throw new Error(payload.error || "Could not sign in.");
  }
  return payload.visit;
}

export async function signOutVisit(id: string): Promise<VisitRecord> {
  const response = await fetch(`/api/visits/${id}`, { method: "PATCH" });
  const payload = (await response.json()) as { visit?: VisitRecord; error?: string };
  if (!response.ok || !payload.visit) {
    throw new Error(payload.error || "Could not sign out.");
  }
  return payload.visit;
}
