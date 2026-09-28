import "server-only";

import { parseEdadminXmlRecords } from "./parse";

export type { EdadminParentRow, EdadminStudentRow } from "./parse";
export {
  parseEdadminParents,
  parseEdadminStudents,
  parseEdadminXmlRecords,
  parseStudentClasses,
} from "./parse";

export type EdadminApiMode = "general" | "sasams";

function trimBase(url: string) {
  return url.replace(/\/+$/, "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unwrapArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const obj = asRecord(payload);
  if (!obj) return [];
  for (const key of ["data", "Data", "students", "Students", "parents", "Parents", "StudentClasses"]) {
    const inner = obj[key];
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

export function edadminApiMode(): EdadminApiMode {
  const mode = process.env.EDADMIN_API_MODE?.trim().toLowerCase();
  return mode === "sasams" ? "sasams" : "general";
}

export const SILVERLEAF_EDADMIN_BASE = "https://silverleafacademy.ed-space.net";

export function edadminBaseUrl(): string {
  const fromEnv = process.env.EDADMIN_BASE_URL?.trim();
  if (fromEnv) return trimBase(fromEnv);
  if (process.env.EDADMIN_GENERAL_API_KEY?.trim() || process.env.EDADMIN_SASAMS_KEY?.trim()) {
    return SILVERLEAF_EDADMIN_BASE;
  }
  return "";
}

export function edadminCampus(): string {
  return process.env.EDADMIN_CAMPUS?.trim() || "Silverleaf";
}

export function edadminConfigured(): boolean {
  const base = edadminBaseUrl();
  if (!base) return false;
  if (edadminApiMode() === "sasams") {
    return Boolean(process.env.EDADMIN_SASAMS_KEY?.trim());
  }
  return Boolean(process.env.EDADMIN_GENERAL_API_KEY?.trim());
}

function apiKeyForMode(mode: EdadminApiMode): string {
  if (mode === "sasams") {
    const key = process.env.EDADMIN_SASAMS_KEY?.trim();
    if (!key) throw new Error("Missing EDADMIN_SASAMS_KEY for SASAMS API");
    return key;
  }
  const key = process.env.EDADMIN_GENERAL_API_KEY?.trim();
  if (!key) throw new Error("Missing EDADMIN_GENERAL_API_KEY for General API");
  return key;
}

export function edadminDataUrl(query: string): string {
  const base = edadminBaseUrl();
  const mode = edadminApiMode();

  if (mode === "sasams") {
    const campus = edadminCampus();
    const params = new URLSearchParams({ query });
    if (campus) params.set("campus", campus);
    if (process.env.EDADMIN_CF_INC === "1") params.set("CFInc", "1");
    return `${base}/api/sasams/v1/data?${params.toString()}`;
  }

  const override = process.env[`EDADMIN_${query.toUpperCase()}_PATH`]?.trim();
  if (override) {
    return override.startsWith("http") ? override : `${base}${override.startsWith("/") ? override : `/${override}`}`;
  }

  return `${base}/api/general/v1/${query}`;
}

function authHeaders(key: string): Record<string, string> {
  return {
    Accept: "application/xml, text/xml, application/json, */*",
    Authorization: `Bearer ${key}`,
  };
}

/** GET Students / Parents / StudentClasses. Returns parsed XML records. */
export async function edadminFetchQuery(query: string): Promise<Record<string, string>[]> {
  if (!edadminConfigured()) {
    throw new Error("Ed-admin not configured (EDADMIN_BASE_URL + API key)");
  }
  const mode = edadminApiMode();
  const key = apiKeyForMode(mode);
  const url = edadminDataUrl(query);

  const res = await fetch(url, {
    headers: authHeaders(key),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Ed-admin GET ${query} → ${res.status} ${text.slice(0, 280)}`);
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("<")) {
    return parseEdadminXmlRecords(trimmed, query);
  }

  try {
    const json = JSON.parse(trimmed) as unknown;
    return unwrapArray(json)
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => row != null)
      .map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? "" : String(v)])),
      );
  } catch {
    throw new Error(`Ed-admin ${query}: expected XML or JSON, got: ${trimmed.slice(0, 120)}`);
  }
}
