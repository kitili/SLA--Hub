import "server-only";

import { getPostgresSql } from "@/lib/db/client";
import { countRecentSignIns } from "@/lib/db/repositories/access";
import { departments, type DepartmentId } from "@/lib/departments";
import { DEPARTMENT_APP } from "@/lib/workplace-lanes";
import { getWorkplaceMap } from "@/lib/workplace-map";
import { listWorkplacePeople } from "@/lib/workplace-people";
import { workplaceSystems } from "@/lib/workplace-systems";

export type KpiMetric = {
  label: string;
  value: string;
  hint?: string;
};

export type DepartmentKpi = {
  id: DepartmentId;
  name: string;
  lane: string;
  liveUrl: string;
  liveOk: boolean;
  people: number;
  lastSeen: string | null;
  score: number;
  headline: string;
  metrics: KpiMetric[];
  note: string;
};

export type WorkplaceKpis = {
  generatedAt: string;
  people: number;
  liveSystems: number;
  totalSystems: number;
  signIns24h: number;
  overallScore: number;
  departments: DepartmentKpi[];
};

type Sql = NonNullable<ReturnType<typeof getPostgresSql>>;

async function n(sql: Sql, query: string): Promise<number> {
  try {
    const rows = await sql.unsafe(query);
    const row = rows[0] as { n?: number } | undefined;
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function scoreOf(liveOk: boolean, people: number, data: number, movement: number) {
  return (
    (liveOk ? 40 : 0) +
    (people > 0 ? 20 : 0) +
    (data > 0 ? 20 : 0) +
    (movement > 0 ? 20 : 0)
  );
}

function fmt(value: number) {
  return new Intl.NumberFormat("en-TZ").format(value);
}

async function onboardingMetrics(sql: Sql): Promise<{ metrics: KpiMetric[]; data: number; movement: number; headline: string }> {
  const [staff, started, reads, signatures, checkpoints, sections, published] = await Promise.all([
    n(sql, "select count(*)::int as n from onboarding.staff"),
    n(sql, "select count(*)::int as n from onboarding.staff where started_at is not null"),
    n(sql, "select count(*)::int as n from onboarding.document_reads"),
    n(sql, "select count(*)::int as n from onboarding.policy_signatures"),
    n(sql, "select count(distinct staff_id)::int as n from onboarding.checkpoint_completions"),
    n(sql, "select count(*)::int as n from onboarding.sections"),
    n(sql, "select count(*)::int as n from onboarding.sections where is_published = true"),
  ]);
  const startRate = pct(started, staff);
  return {
    data: staff + reads + signatures,
    movement: checkpoints + started,
    headline: `${startRate}% of staff have started onboarding`,
    metrics: [
      { label: "Staff in onboarding", value: fmt(staff) },
      { label: "Started", value: `${fmt(started)} (${startRate}%)` },
      { label: "Policy signatures", value: fmt(signatures) },
      { label: "Document reads", value: fmt(reads) },
      { label: "People with a checkpoint", value: fmt(checkpoints), hint: `${fmt(published)}/${fmt(sections)} sections published` },
    ],
  };
}

async function opsMetrics(sql: Sql): Promise<{ metrics: KpiMetric[]; data: number; movement: number; headline: string }> {
  const [students, activeStudents, buses, trips, openTrips, incidents, issues, openIssues, profiles] = await Promise.all([
    n(sql, "select count(*)::int as n from public.students"),
    n(sql, "select count(*)::int as n from public.students where active = true"),
    n(sql, "select count(*)::int as n from public.buses"),
    n(sql, "select count(*)::int as n from public.trips"),
    n(sql, "select count(*)::int as n from public.trips where ended_at is null"),
    n(sql, "select count(*)::int as n from public.incidents where created_at >= now() - interval '30 days'"),
    n(sql, "select count(*)::int as n from public.facilities_issues"),
    n(sql, `select count(*)::int as n from public.facilities_issues where coalesce(status, '') not ilike '%resolved%' and resolved_date is null`),
    n(sql, "select count(*)::int as n from public.profiles"),
  ]);
  return {
    data: students + buses + trips,
    movement: incidents + openIssues + openTrips,
    headline: `${fmt(activeStudents)} active students on ${fmt(buses)} buses`,
    metrics: [
      { label: "Active students", value: `${fmt(activeStudents)} / ${fmt(students)}` },
      { label: "Buses", value: fmt(buses) },
      { label: "Trips logged", value: fmt(trips), hint: `${fmt(openTrips)} still open` },
      { label: "Incidents (30 days)", value: fmt(incidents) },
      { label: "Open facilities issues", value: `${fmt(openIssues)} / ${fmt(issues)}` },
      { label: "Ops profiles", value: fmt(profiles) },
    ],
  };
}

async function dataTechMetrics(sql: Sql): Promise<{ metrics: KpiMetric[]; data: number; movement: number; headline: string }> {
  const [users, tickets, openTickets, tasks, openTasks, fives, fivesToday] = await Promise.all([
    n(sql, "select count(*)::int as n from data_tech.users"),
    n(sql, "select count(*)::int as n from data_tech.tickets"),
    n(sql, "select count(*)::int as n from data_tech.tickets where resolved_at is null"),
    n(sql, "select count(*)::int as n from data_tech.system_tasks where coalesce(archived, false) = false"),
    n(sql, `select count(*)::int as n from data_tech.system_tasks where coalesce(archived, false) = false and coalesce(status, '') not ilike '%done%' and coalesce(status, '') not ilike '%complete%'`),
    n(sql, "select count(*)::int as n from data_tech.one_to_fives"),
    n(sql, "select count(*)::int as n from data_tech.one_to_fives where work_date = (now() at time zone 'Africa/Nairobi')::date"),
  ]);
  return {
    data: users + tickets + tasks,
    movement: openTickets + fivesToday,
    headline: `${fmt(openTickets)} open tickets · ${fmt(fivesToday)} 1–5s today`,
    metrics: [
      { label: "Users", value: fmt(users) },
      { label: "Open tickets", value: `${fmt(openTickets)} / ${fmt(tickets)}` },
      { label: "Open system tasks", value: `${fmt(openTasks)} / ${fmt(tasks)}` },
      { label: "1–5s filed", value: fmt(fives), hint: `${fmt(fivesToday)} today` },
    ],
  };
}

async function workboardMetrics(sql: Sql): Promise<{ metrics: KpiMetric[]; data: number; movement: number; headline: string }> {
  const [users, plans, items, doneItems, tasks, doneTasks] = await Promise.all([
    n(sql, `select count(*)::int as n from workboard."User"`),
    n(sql, `select count(*)::int as n from workboard."DailyPlan"`),
    n(sql, `select count(*)::int as n from workboard."DailyPlanItem"`),
    n(sql, `select count(*)::int as n from workboard."DailyPlanItem" where "completedAt" is not null`),
    n(sql, `select count(*)::int as n from workboard."Task"`),
    n(sql, `select count(*)::int as n from workboard."Task" where "completedAt" is not null`),
  ]);
  const doneRate = pct(doneItems, items);
  return {
    data: users + plans + tasks,
    movement: doneItems + doneTasks,
    headline: `${doneRate}% of 1–5 slots marked done`,
    metrics: [
      { label: "People on 1–5’s", value: fmt(users) },
      { label: "Daily plans", value: fmt(plans) },
      { label: "1–5 slots done", value: `${fmt(doneItems)} / ${fmt(items)} (${doneRate}%)` },
      { label: "Board cards done", value: `${fmt(doneTasks)} / ${fmt(tasks)}` },
    ],
  };
}

async function visitorsMetrics(sql: Sql): Promise<{ metrics: KpiMetric[]; data: number; movement: number; headline: string }> {
  const [visits, openVisits, today, campuses] = await Promise.all([
    n(sql, "select count(*)::int as n from visitors.visits"),
    n(sql, "select count(*)::int as n from visitors.visits where signed_out_at is null"),
    n(sql, "select count(*)::int as n from visitors.visits where date = to_char((now() at time zone 'Africa/Nairobi')::date, 'YYYY-MM-DD')"),
    n(sql, "select count(distinct campus)::int as n from visitors.visits"),
  ]);
  return {
    data: visits,
    movement: today + openVisits,
    headline: `${fmt(today)} visits today · ${fmt(openVisits)} still on campus`,
    metrics: [
      { label: "Visits logged", value: fmt(visits) },
      { label: "Still signed in", value: fmt(openVisits) },
      { label: "Today", value: fmt(today) },
      { label: "Campuses", value: fmt(campuses) },
    ],
  };
}

function reserved(name: string, liveOk: boolean) {
  return {
    metrics: [
      {
        label: "Lane in this Supabase",
        value: "Reserved",
        hint: liveOk
          ? `${name} is live. Counts still live on that site’s own database.`
          : `${name} lane is reserved until data is loaded here.`,
      },
    ],
    data: 0,
    movement: liveOk ? 1 : 0,
    headline: liveOk ? `${name} is live on its own database` : `${name} lane is reserved`,
  };
}

export async function getWorkplaceKpis(): Promise<WorkplaceKpis> {
  const sql = getPostgresSql();
  const [map, people, signIns24h] = await Promise.all([
    getWorkplaceMap(),
    listWorkplacePeople({ limit: 500 }),
    countRecentSignIns(24),
  ]);

  const peopleByApp = new Map<string, { count: number; lastSeen: string | null }>();
  for (const person of people) {
    for (const app of person.apps) {
      const current = peopleByApp.get(app) ?? { count: 0, lastSeen: null };
      current.count += 1;
      if (person.lastSeen && (!current.lastSeen || person.lastSeen > current.lastSeen)) {
        current.lastSeen = person.lastSeen;
      }
      peopleByApp.set(app, current);
    }
  }

  const extra = sql
    ? {
        onboarding: await onboardingMetrics(sql),
        ops: await opsMetrics(sql),
        "data-tech": await dataTechMetrics(sql),
        "workboard-tasks": await workboardMetrics(sql),
        visitors: await visitorsMetrics(sql),
      }
    : {};

  const departmentKpis: DepartmentKpi[] = departments.map((department) => {
    const system = workplaceSystems.find((row) => row.id === department.id);
    const smoke = map.find((row) => row.id === department.id)?.smoke;
    const liveOk = smoke?.ok === true;
    const app = DEPARTMENT_APP[department.id];
    const crowd = peopleByApp.get(app);
    const deep =
      extra[department.id as keyof typeof extra] ??
      reserved(department.name, liveOk);
    const score = scoreOf(liveOk, crowd?.count ?? 0, deep.data, deep.movement);
    return {
      id: department.id,
      name: department.name,
      lane: system?.lane ?? department.name.toUpperCase(),
      liveUrl: department.liveUrl,
      liveOk,
      people: crowd?.count ?? 0,
      lastSeen: crowd?.lastSeen ?? null,
      score,
      headline: deep.headline,
      metrics: deep.metrics,
      note: system?.notes ?? department.summary,
    };
  });

  const overallScore =
    departmentKpis.length === 0
      ? 0
      : Math.round(departmentKpis.reduce((sum, row) => sum + row.score, 0) / departmentKpis.length);

  return {
    generatedAt: new Date().toISOString(),
    people: people.length,
    liveSystems: map.filter((row) => row.id !== "hub" && row.smoke.ok).length,
    totalSystems: departments.length,
    signIns24h,
    overallScore,
    departments: departmentKpis,
  };
}
