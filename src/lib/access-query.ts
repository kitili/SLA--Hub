import { departments } from "@/lib/departments";

export const ACCESS_PAGE_SIZE = 25;
export const ACCESS_WINDOW_LIMIT = 400;

export type AccessQuery = {
  staffId: string;
  departmentId: string;
  action: string;
  from: string;
  to: string;
  page: number;
};

function eatToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00+03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function defaultAccessQuery(): AccessQuery {
  const to = eatToday();
  return {
    staffId: "",
    departmentId: "",
    action: "",
    from: addDays(to, -6),
    to,
    page: 1,
  };
}

export function parseAccessQuery(input: Record<string, string | string[] | undefined>): AccessQuery {
  const defaults = defaultAccessQuery();
  const read = (key: string) => {
    const value = input[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const from = isIsoDate(read("from")) ? read("from") : defaults.from;
  const to = isIsoDate(read("to")) ? read("to") : defaults.to;
  const page = Math.max(1, Number.parseInt(read("page") || "1", 10) || 1);
  const departmentId = departments.some((department) => department.id === read("desk"))
    ? read("desk")
    : "";
  const action = ["signed_in", "signed_out", "opened_desk", "opened_hub"].includes(read("what"))
    ? read("what")
    : "";
  return {
    staffId: read("person"),
    departmentId,
    action,
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    page,
  };
}

export function accessRange(query: AccessQuery) {
  return {
    from: new Date(`${query.from}T00:00:00+03:00`),
    to: new Date(`${query.to}T23:59:59.999+03:00`),
  };
}

export function accessQueryHref(query: AccessQuery, patch: Partial<AccessQuery> = {}, base = "/activity") {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (!base.startsWith("/activity/") && next.staffId) params.set("person", next.staffId);
  if (next.departmentId) params.set("desk", next.departmentId);
  if (next.action) params.set("what", next.action);
  params.set("from", next.from);
  params.set("to", next.to);
  if (next.page > 1) params.set("page", String(next.page));
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

export function accessPersonHref(staffId: string, query: AccessQuery) {
  const params = new URLSearchParams();
  if (query.departmentId) params.set("desk", query.departmentId);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const search = params.toString();
  return search ? `/activity/${staffId}?${search}` : `/activity/${staffId}`;
}
