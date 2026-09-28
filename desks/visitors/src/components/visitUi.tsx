"use client";

import { useCallback, useEffect, useState } from "react";
import { CAMPUS_NAMES, Campus } from "@/domain/Campus";
import type { VisitRecord } from "@/domain/types";

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "Request failed");
  }
  return body;
}

export function useCampus(initial?: string) {
  const [campus, setCampus] = useState(Campus.tryParse(initial)?.name ?? CAMPUS_NAMES[0]);
  return { campus, setCampus, campuses: CAMPUS_NAMES };
}

export function useVisits(campus: string, date = todayKey(), onSiteOnly = false) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ date });
    if (campus) params.set("campus", campus);
    if (onSiteOnly) params.set("onSite", "1");
    try {
      const data = await api<{ visits: VisitRecord[] }>(`/api/visits?${params}`);
      setVisits(data.visits);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load visits");
    }
  }, [campus, date, onSiteOnly]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { visits, error, refresh };
}

export function CampusPills({
  campus,
  onChange,
}: {
  campus: string;
  onChange: (campus: string) => void;
}) {
  return (
    <div className="campus-row" role="tablist" aria-label="Campus">
      {CAMPUS_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          className={`campus-pill${campus === name ? " active" : ""}`}
          onClick={() => onChange(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
