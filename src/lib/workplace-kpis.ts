import "server-only";

import { getPostgresSql } from "@/lib/db/client";
import { countRecentSignIns } from "@/lib/db/repositories/access";
import { departments, type DepartmentId } from "@/lib/departments";
import { formatWhen } from "@/lib/format-when";
import { DEPARTMENT_APP } from "@/lib/workplace-lanes";
import { listWorkplacePeople } from "@/lib/workplace-people";
import type { DepartmentKpi, KpiMetric, WorkplaceKpis } from "@/lib/workplace-kpi-types";

export type { DepartmentKpi, KpiMetric, WorkplaceKpis };

type Sql = NonNullable<ReturnType<typeof getPostgresSql>>;
type Deep = { metrics: KpiMetric[]; data: number; movement: number; headline: string };

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

function fmt(value: number) {
  return new Intl.NumberFormat("en-TZ").format(value);
}

function peopleOnly(name: string, people: number, lastSeen: string | null, summary: string): Deep {
  return {
    data: people,
    movement: people > 0 ? 1 : 0,
    headline: people > 0 ? `${fmt(people)} people on ${name}` : summary,
    metrics: [
      { label: "People on this desk", value: fmt(people) },
      { label: "Last seen", value: formatWhen(lastSeen, "No activity yet") },
    ],
  };
}

async function onboardingMetrics(sql: Sql): Promise<Deep> {
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

async function opsMetrics(sql: Sql): Promise<Deep> {
  const [students, activeStudents, buses, trips, openTrips, incidents, issues, openIssues] = await Promise.all([
    n(sql, "select count(*)::int as n from public.students"),
    n(sql, "select count(*)::int as n from public.students where active = true"),
    n(sql, "select count(*)::int as n from public.buses"),
    n(sql, "select count(*)::int as n from public.trips"),
    n(sql, "select count(*)::int as n from public.trips where ended_at is null"),
    n(sql, "select count(*)::int as n from public.incidents where created_at >= now() - interval '30 days'"),
    n(sql, "select count(*)::int as n from public.facilities_issues"),
    n(sql, `select count(*)::int as n from public.facilities_issues where coalesce(status, '') not ilike '%resolved%' and resolved_date is null`),
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
    ],
  };
}

async function dataTechMetrics(sql: Sql): Promise<Deep> {
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

async function workboardMetrics(sql: Sql): Promise<Deep> {
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

async function visitorsMetrics(sql: Sql): Promise<Deep> {
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

async function uniformsMetrics(sql: Sql): Promise<Deep> {
  const [orders, users, campuses, jobs] = await Promise.all([
    n(sql, `select count(*)::int as n from uniforms."ParentOrder"`),
    n(sql, `select count(*)::int as n from uniforms."User"`),
    n(sql, `select count(*)::int as n from uniforms."Campus"`),
    n(sql, `select count(*)::int as n from uniforms."SewingJob"`),
  ]);
  return {
    data: orders + users + campuses + jobs,
    movement: orders + jobs,
    headline: `${fmt(orders)} parent orders · ${fmt(jobs)} sewing jobs`,
    metrics: [
      { label: "Parent orders", value: fmt(orders) },
      { label: "Sewing jobs", value: fmt(jobs) },
      { label: "Campuses", value: fmt(campuses) },
      { label: "Users", value: fmt(users) },
    ],
  };
}

async function marketingMetrics(sql: Sql): Promise<Deep> {
  const [leads, students, tours, campaigns] = await Promise.all([
    n(sql, "select count(*)::int as n from marketing.marketing_leads"),
    n(sql, "select count(*)::int as n from marketing.students"),
    n(sql, "select count(*)::int as n from marketing.tour_bookings"),
    n(sql, "select count(*)::int as n from marketing.marketing_campaigns"),
  ]);
  return {
    data: leads + students + tours + campaigns,
    movement: leads + tours,
    headline: `${fmt(leads)} leads · ${fmt(tours)} tours`,
    metrics: [
      { label: "Leads", value: fmt(leads) },
      { label: "Students", value: fmt(students) },
      { label: "Tour bookings", value: fmt(tours) },
      { label: "Campaigns", value: fmt(campaigns) },
    ],
  };
}

async function talentMetrics(sql: Sql): Promise<Deep> {
  const [teachers, fellows, courses, certificates] = await Promise.all([
    n(sql, "select count(*)::int as n from talent.teachers"),
    n(sql, "select count(*)::int as n from talent.users"),
    n(sql, "select count(*)::int as n from talent.courses"),
    n(sql, "select count(*)::int as n from talent.teacher_certificates"),
  ]);
  return {
    data: teachers + fellows + courses + certificates,
    movement: teachers + certificates,
    headline: `${fmt(teachers)} teachers · ${fmt(certificates)} certificates`,
    metrics: [
      { label: "Teachers", value: fmt(teachers) },
      { label: "Users", value: fmt(fellows) },
      { label: "Courses", value: fmt(courses) },
      { label: "Certificates", value: fmt(certificates) },
    ],
  };
}

async function lessonPlanMetrics(sql: Sql): Promise<Deep> {
  const [plans, schemes, staff, textbooks] = await Promise.all([
    n(sql, "select count(*)::int as n from lesson_plans.lesson_plans"),
    n(sql, "select count(*)::int as n from lesson_plans.schemes_of_work"),
    n(sql, "select count(*)::int as n from lesson_plans.staff"),
    n(sql, "select count(*)::int as n from lesson_plans.textbooks"),
  ]);
  return {
    data: plans + schemes + staff + textbooks,
    movement: plans + schemes,
    headline: `${fmt(plans)} lesson plans · ${fmt(schemes)} schemes`,
    metrics: [
      { label: "Lesson plans", value: fmt(plans) },
      { label: "Schemes of work", value: fmt(schemes) },
      { label: "Staff", value: fmt(staff) },
      { label: "Textbooks", value: fmt(textbooks) },
    ],
  };
}

async function melMetrics(sql: Sql): Promise<Deep> {
  const [rows] = await Promise.all([
    n(sql, "select count(*)::int as n from mel.indicators"),
  ]);
  return {
    data: rows,
    movement: rows,
    headline: `${fmt(rows)} MEL indicators`,
    metrics: [{ label: "Indicators", value: fmt(rows) }],
  };
}

function emptyKpis(): WorkplaceKpis {
  return {
    generatedAt: new Date().toISOString(),
    people: 0,
    totalSystems: departments.length,
    signIns24h: 0,
    departments: departments.map((department) => ({
      id: department.id,
      name: department.name,
      liveUrl: department.liveUrl,
      people: 0,
      lastSeen: null,
      headline: department.summary,
      metrics: [],
      note: department.summary,
    })),
  };
}

export async function getWorkplaceKpis(): Promise<WorkplaceKpis> {
  try {
    const sql = getPostgresSql();
    const [people, signIns24h] = await Promise.all([
      listWorkplacePeople({ limit: 500 }),
      countRecentSignIns(24),
    ]);

    const peopleByApp = new Map<string, { count: number; lastSeen: string | null }>();
    for (const person of people) {
      for (const app of person.apps ?? []) {
        const current = peopleByApp.get(app) ?? { count: 0, lastSeen: null };
        current.count += 1;
        if (person.lastSeen && (!current.lastSeen || person.lastSeen > current.lastSeen)) {
          current.lastSeen = person.lastSeen;
        }
        peopleByApp.set(app, current);
      }
    }

    const extra: Partial<Record<DepartmentId, Deep>> = sql
      ? {
          onboarding: await onboardingMetrics(sql),
          ops: await opsMetrics(sql),
          "data-tech": await dataTechMetrics(sql),
          "workboard-tasks": await workboardMetrics(sql),
          visitors: await visitorsMetrics(sql),
          uniforms: await uniformsMetrics(sql),
          marketing: await marketingMetrics(sql),
          "talent-academy": await talentMetrics(sql),
          "lesson-plans": await lessonPlanMetrics(sql),
          "mel-dashboard": await melMetrics(sql),
        }
      : {};

    const departmentKpis: DepartmentKpi[] = departments.map((department) => {
      const app = DEPARTMENT_APP[department.id];
      const crowd = peopleByApp.get(app);
      const loaded = extra[department.id];
      const deep =
        loaded && loaded.data > 0
          ? loaded
          : peopleOnly(department.name, crowd?.count ?? 0, crowd?.lastSeen ?? null, department.summary);
      return {
        id: department.id,
        name: department.name,
        liveUrl: department.liveUrl,
        people: crowd?.count ?? 0,
        lastSeen: crowd?.lastSeen ?? null,
        headline: deep.headline,
        metrics: deep.metrics,
        note: department.summary,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      people: people.length,
      totalSystems: departments.length,
      signIns24h,
      departments: departmentKpis,
    };
  } catch {
    return emptyKpis();
  }
}
