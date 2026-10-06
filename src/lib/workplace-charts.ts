import "server-only";

import { getPostgresSql } from "@/lib/db/client";
import { departments } from "@/lib/departments";
import type { HourBeat, PulsePoint } from "@/lib/workplace-kpi-types";

type Sql = NonNullable<ReturnType<typeof getPostgresSql>>;

const ZONE = "Africa/Nairobi";
const DAYS = 14;

async function rows<T>(sql: Sql, query: string): Promise<T[]> {
  try {
    return (await sql.unsafe(query)) as T[];
  } catch {
    return [];
  }
}

function nairobiDay(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(date);
}

function lastDays(): string[] {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE });
  const now = new Date();
  return Array.from({ length: DAYS }, (_, index) => {
    const day = new Date(now.getTime() - (DAYS - 1 - index) * 86400000);
    return formatter.format(day);
  });
}

function dayLabel(day: string) {
  return new Intl.DateTimeFormat("en-TZ", {
    timeZone: ZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00+03:00`));
}

function hourLabel(hour: number) {
  if (hour === 0) return "12 am";
  if (hour === 12) return "12 pm";
  if (hour < 12) return `${hour} am`;
  return `${hour - 12} pm`;
}

function asCounts(list: Array<{ d?: unknown; n?: unknown }>) {
  const map = new Map<string, number>();
  for (const row of list) {
    const day = nairobiDay(row.d as Date | string);
    if (!day) continue;
    map.set(day, (map.get(day) ?? 0) + Number(row.n ?? 0));
  }
  return map;
}

export type WorkplaceCharts = {
  pulse: PulsePoint[];
  hours: HourBeat[];
  sparks: Record<string, number[]>;
};

export async function getWorkplaceCharts(dept?: string | null): Promise<WorkplaceCharts> {
  const empty: WorkplaceCharts = {
    pulse: lastDays().map((day) => ({ day, label: dayLabel(day), hub: 0, work: 0 })),
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, label: hourLabel(hour), count: 0 })),
    sparks: Object.fromEntries(departments.map((department) => [department.id, Array(DAYS).fill(0)])),
  };
  const sql = getPostgresSql();
  if (!sql) return empty;

  const desk = departments.some((department) => department.id === dept) ? dept : null;
  const deskFilter = desk ? `and department_id = '${desk}'` : "";

  const [hubDays, tripDays, visitDays, fiveDays, startDays, hourRows, sparkRows] = await Promise.all([
    rows<{ d: unknown; n: number }>(
      sql,
      `select (created_at at time zone '${ZONE}')::date as d, count(*)::int as n
       from access_events
       where created_at >= now() - interval '${DAYS} days' ${deskFilter}
       group by 1`,
    ),
    dept && dept !== "ops"
      ? Promise.resolve([])
      : rows<{ d: unknown; n: number }>(
          sql,
          `select trip_date::date as d, count(*)::int as n
           from public.trips
           where trip_date >= (now() at time zone '${ZONE}')::date - ${DAYS}
           group by 1`,
        ),
    dept && dept !== "visitors"
      ? Promise.resolve([])
      : rows<{ d: unknown; n: number }>(
          sql,
          `select date as d, count(*)::int as n
           from visitors.visits
           where date >= to_char((now() at time zone '${ZONE}')::date - ${DAYS}, 'YYYY-MM-DD')
           group by 1`,
        ),
    dept && dept !== "data-tech" && dept !== "workboard-tasks"
      ? Promise.resolve([])
      : rows<{ d: unknown; n: number }>(
          sql,
          `select work_date as d, count(*)::int as n
           from data_tech.one_to_fives
           where work_date >= (now() at time zone '${ZONE}')::date - ${DAYS}
           group by 1`,
        ),
    dept && dept !== "onboarding"
      ? Promise.resolve([])
      : rows<{ d: unknown; n: number }>(
          sql,
          `select (started_at at time zone '${ZONE}')::date as d, count(*)::int as n
           from onboarding.staff
           where started_at >= now() - interval '${DAYS} days'
           group by 1`,
        ),
    rows<{ h: number; n: number }>(
      sql,
      `select extract(hour from created_at at time zone '${ZONE}')::int as h, count(*)::int as n
       from access_events
       where created_at >= now() - interval '${DAYS} days' ${deskFilter}
       group by 1`,
    ),
    rows<{ department_id: string | null; d: unknown; n: number }>(
      sql,
      `select department_id, (created_at at time zone '${ZONE}')::date as d, count(*)::int as n
       from access_events
       where created_at >= now() - interval '${DAYS} days'
         and department_id is not null
       group by 1, 2`,
    ),
  ]);

  const hub = asCounts(hubDays);
  const work = asCounts([...tripDays, ...visitDays, ...fiveDays, ...startDays]);
  const days = lastDays();
  const pulse = days.map((day) => ({
    day,
    label: dayLabel(day),
    hub: hub.get(day) ?? 0,
    work: work.get(day) ?? 0,
  }));

  const hourMap = new Map(hourRows.map((row) => [Number(row.h), Number(row.n)]));
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    count: hourMap.get(hour) ?? 0,
  }));

  const sparks: Record<string, number[]> = {};
  for (const department of departments) {
    const byDay = asCounts(sparkRows.filter((row) => row.department_id === department.id));
    sparks[department.id] = days.map((day) => byDay.get(day) ?? 0);
  }

  return { pulse, hours, sparks };
}
