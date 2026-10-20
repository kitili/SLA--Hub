import "server-only";

import { getPostgresSql } from "@/lib/db/client";

export type BridgeFact = { label: string; value: string };

export type BridgeHandoff = {
  id: string;
  from: string;
  to: string[];
  title: string;
  summary: string;
  available: boolean;
  facts: BridgeFact[];
};

type Sql = NonNullable<ReturnType<typeof getPostgresSql>>;

function fmt(value: number) {
  return new Intl.NumberFormat("en-TZ").format(value);
}

async function count(sql: Sql, query: string): Promise<number | null> {
  try {
    const rows = await sql.unsafe(query);
    const row = rows[0] as { n?: number } | undefined;
    return Number(row?.n ?? 0);
  } catch {
    return null;
  }
}

async function grouped(sql: Sql, query: string): Promise<Array<{ label: string; n: number }> | null> {
  try {
    const rows = await sql.unsafe(query);
    return rows.map((row) => {
      const record = row as { label?: string; n?: number };
      return { label: String(record.label ?? "").trim() || "Unstated", n: Number(record.n ?? 0) };
    });
  } catch {
    return null;
  }
}

function handoff(
  id: string,
  from: string,
  to: string[],
  title: string,
  summary: string,
  facts: BridgeFact[],
): BridgeHandoff {
  return { id, from, to, title, summary, available: facts.length > 0, facts };
}

export async function getSystemBridge(): Promise<BridgeHandoff[]> {
  const sql = getPostgresSql();
  if (!sql) return [];

  const [
    behaviour,
    medical,
    openFacilities,
    activeStudents,
    visitorsOpen,
    visitorsToday,
    visitorCampuses,
    uniformStatuses,
    leadStages,
    marketingStudents,
    staff,
    started,
    signatures,
    teachers,
    certificates,
    courses,
    plans,
    schemes,
    openTickets,
    planItems,
    planItemsDone,
    indicators,
    mailboxBehaviour,
    mailboxTraining,
    mailboxPd,
  ] = await Promise.all([
    count(sql, `select count(*)::int as n from public.incidents where type = 'behavior' and created_at >= now() - interval '90 days'`),
    count(sql, `select count(*)::int as n from public.incidents where type = 'medical' and created_at >= now() - interval '90 days'`),
    count(sql, `select count(*)::int as n from public.facilities_issues where coalesce(status, '') not ilike '%resolved%' and resolved_date is null`),
    count(sql, `select count(*)::int as n from public.students where active = true`),
    count(sql, `select count(*)::int as n from visitors.visits where signed_out_at is null`),
    count(sql, `select count(*)::int as n from visitors.visits where date = to_char((now() at time zone 'Africa/Nairobi')::date, 'YYYY-MM-DD')`),
    grouped(sql, `select campus as label, count(*)::int as n from visitors.visits where signed_out_at is null group by campus order by n desc limit 6`),
    grouped(sql, `select status as label, count(*)::int as n from uniforms."ParentOrder" group by status order by n desc limit 6`),
    grouped(sql, `select computed_stage as label, count(*)::int as n from marketing.marketing_leads group by computed_stage order by n desc limit 8`),
    count(sql, `select count(*)::int as n from marketing.students`),
    count(sql, `select count(*)::int as n from onboarding.staff`),
    count(sql, `select count(*)::int as n from onboarding.staff where started_at is not null`),
    count(sql, `select count(*)::int as n from onboarding.policy_signatures`),
    count(sql, `select count(*)::int as n from talent.teachers`),
    count(sql, `select count(*)::int as n from talent.teacher_certificates`),
    count(sql, `select count(*)::int as n from talent.courses`),
    count(sql, `select count(*)::int as n from lesson_plans.lesson_plans`),
    count(sql, `select count(*)::int as n from lesson_plans.schemes_of_work`),
    count(sql, `select count(*)::int as n from data_tech.tickets where resolved_at is null`),
    count(sql, `select count(*)::int as n from workboard."DailyPlanItem"`),
    count(sql, `select count(*)::int as n from workboard."DailyPlanItem" where "completedAt" is not null`),
    count(sql, `select count(*)::int as n from mel.indicators`),
    count(sql, `select count(*)::int as n from system_links where kind = 'ops.behaviour'`),
    count(sql, `select count(*)::int as n from system_links where kind = 'talent.training'`),
    count(sql, `select count(*)::int as n from system_links where kind = 'academics.pd'`),
  ]);

  const rows: BridgeHandoff[] = [];

  if (behaviour != null || medical != null || mailboxBehaviour) {
    const facts: BridgeFact[] = [];
    if (behaviour != null) facts.push({ label: "Behaviour reports, 90 days", value: fmt(behaviour) });
    if (medical != null) facts.push({ label: "Medical reports, 90 days", value: fmt(medical) });
    if (mailboxBehaviour) facts.push({ label: "Handed to Student Experience", value: fmt(mailboxBehaviour) });
    rows.push(handoff("ops.care", "Ops", ["student-experience"], "Care reports", "Matron behaviour and medical reports for Student Experience.", facts));
  }

  if (openFacilities != null) {
    rows.push(handoff("ops.facilities", "Ops", ["data-tech"], "Open buildings issues", "Facilities issues still open, for Data & Tech to see beside tickets.", [
      { label: "Open issues", value: fmt(openFacilities) },
    ]));
  }

  if (activeStudents != null) {
    rows.push(handoff("ops.register", "Ops", ["uniforms"], "Active pupils", "How many active pupils the uniform store is clothing.", [
      { label: "Active pupils", value: fmt(activeStudents) },
    ]));
  }

  if (visitorsOpen != null || visitorsToday != null) {
    const facts: BridgeFact[] = [];
    if (visitorsToday != null) facts.push({ label: "Visits today", value: fmt(visitorsToday) });
    if (visitorsOpen != null) facts.push({ label: "Still signed in", value: fmt(visitorsOpen) });
    for (const campus of visitorCampuses ?? []) {
      facts.push({ label: campus.label, value: fmt(campus.n) });
    }
    rows.push(handoff("visitors.onsite", "Visitors", ["ops"], "Who is on campus", "Front-desk visits Ops can see, by campus.", facts));
  }

  if (uniformStatuses) {
    const total = uniformStatuses.reduce((sum, row) => sum + row.n, 0);
    rows.push(handoff("uniforms.orders", "Uniforms", ["marketing"], "Parent uniform orders", "Order status for families, already counted from the shared register.", [
      { label: "Orders", value: fmt(total) },
      ...uniformStatuses.map((row) => ({ label: row.label, value: fmt(row.n) })),
    ]));
  }

  if (leadStages) {
    const total = leadStages.reduce((sum, row) => sum + row.n, 0);
    rows.push(handoff("marketing.pipeline", "Marketing", ["ops"], "Admission pipeline", "Where families are in admissions, without contact details.", [
      { label: "Leads", value: fmt(total) },
      ...leadStages.map((row) => ({ label: row.label, value: fmt(row.n) })),
    ]));
  }

  if (marketingStudents != null) {
    rows.push(handoff("marketing.students", "Marketing", ["student-experience"], "Student experience register", "Pupils already on the student-experience register.", [
      { label: "Pupils", value: fmt(marketingStudents) },
    ]));
  }

  if (staff != null) {
    const facts: BridgeFact[] = [{ label: "Staff records", value: fmt(staff) }];
    if (started != null) facts.push({ label: "Started", value: fmt(started) });
    if (signatures != null) facts.push({ label: "Policy signatures", value: fmt(signatures) });
    rows.push(handoff("onboarding.progress", "Onboarding", ["talent-academy"], "New staff progress", "How far new staff have got, for Talent Academy.", facts));
  }

  if (teachers != null || certificates != null || courses != null || mailboxTraining) {
    const facts: BridgeFact[] = [];
    if (teachers != null) facts.push({ label: "Teachers", value: fmt(teachers) });
    if (courses != null) facts.push({ label: "Courses", value: fmt(courses) });
    if (certificates != null) facts.push({ label: "Certificates", value: fmt(certificates) });
    if (mailboxTraining) facts.push({ label: "Training snapshots shared", value: fmt(mailboxTraining) });
    rows.push(handoff("talent.learning", "Talent Academy", ["lesson-plans", "onboarding"], "Training", "Course and certificate counts for Academics and Onboarding.", facts));
  }

  if (plans != null || schemes != null || mailboxPd) {
    const facts: BridgeFact[] = [];
    if (plans != null) facts.push({ label: "Lesson plans", value: fmt(plans) });
    if (schemes != null) facts.push({ label: "Schemes of work", value: fmt(schemes) });
    if (mailboxPd) facts.push({ label: "Professional-development snapshots", value: fmt(mailboxPd) });
    rows.push(handoff("academics.supply", "Academics", ["talent-academy", "mel-dashboard"], "Academic supply", "Plans and schemes Talent Academy and MEL can read.", facts));
  }

  if (openTickets != null) {
    rows.push(handoff("data-tech.tickets", "Data & Tech", ["workboard-tasks"], "Open tickets", "Unresolved tickets for the 1–5’s board.", [
      { label: "Open tickets", value: fmt(openTickets) },
    ]));
  }

  if (planItems != null) {
    const done = planItemsDone ?? 0;
    const rate = planItems > 0 ? Math.round((done / planItems) * 100) : 0;
    rows.push(handoff("workboard.progress", "1–5’s", ["data-tech"], "1–5 completion", "How much of today’s work is marked done.", [
      { label: "Slots done", value: `${fmt(done)} / ${fmt(planItems)}` },
      { label: "Done", value: `${rate}%` },
    ]));
  }

  if (indicators != null) {
    rows.push(handoff("mel.indicators", "MEL", ["lesson-plans"], "Indicators", "MEL indicator count for Academics.", [
      { label: "Indicators", value: fmt(indicators) },
    ]));
  }

  return rows;
}

export function bridgeFor(rows: BridgeHandoff[], to: string): BridgeHandoff[] {
  return rows.filter((row) => row.to.includes(to) && row.available);
}
