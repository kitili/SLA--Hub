import "server-only";

import { getPostgresSql } from "@/lib/db/client";

export type WorkplacePerson = {
  email: string;
  fullName: string;
  jobTitle: string | null;
  campus: string | null;
  apps: string[];
  lastSeen: string | null;
};

function asIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export type WorkplacePeopleFilter = {
  campus?: string;
  app?: string;
  q?: string;
  since?: Date | null;
  emailOnly?: boolean;
  limit?: number;
  offset?: number;
};

export async function listWorkplacePeople(
  filter: WorkplacePeopleFilter = {},
): Promise<WorkplacePerson[]> {
  const sql = getPostgresSql();
  if (!sql) return [];
  const campus = filter.campus?.trim();
  const app = filter.app?.trim();
  const q = filter.q?.trim();
  const since = filter.since ?? null;
  const limit = filter.limit ?? 500;
  const offset = filter.offset ?? 0;
  const clauses = [];
  if (filter.emailOnly) clauses.push(sql`email like ${"%@%"}`);
  if (campus) clauses.push(sql`campus ilike ${campus}`);
  if (app) clauses.push(sql`${app} = any(apps)`);
  if (q) {
    const like = `%${q}%`;
    clauses.push(sql`(full_name ilike ${like} or email ilike ${like})`);
  }
  if (since) clauses.push(sql`last_seen >= ${since}`);
  const where = clauses.length
    ? clauses.reduce((left, right) => sql`${left} and ${right}`)
    : sql`true`;
  const rows = await sql<
    {
      email: string;
      full_name: string;
      job_title: string | null;
      campus: string | null;
      apps: string[];
      last_seen: Date | string | null;
    }[]
  >`
    select email, full_name, job_title, campus, apps, last_seen
    from shared.people
    where ${where}
    order by full_name, email
    limit ${limit}
    offset ${offset}
  `;
  return rows.map((row) => ({
    email: row.email,
    fullName: row.full_name,
    jobTitle: row.job_title,
    campus: row.campus,
    apps: row.apps ?? [],
    lastSeen: asIso(row.last_seen),
  }));
}

export async function getWorkplacePerson(email: string): Promise<WorkplacePerson | null> {
  const sql = getPostgresSql();
  const needle = email.trim().toLowerCase();
  if (!sql || !needle) return null;
  const [row] = await sql<
    {
      email: string;
      full_name: string;
      job_title: string | null;
      campus: string | null;
      apps: string[];
      last_seen: Date | string | null;
    }[]
  >`
    select email, full_name, job_title, campus, apps, last_seen
    from shared.people
    where email = ${needle}
    limit 1
  `;
  if (!row) return null;
  return {
    email: row.email,
    fullName: row.full_name,
    jobTitle: row.job_title,
    campus: row.campus,
    apps: row.apps ?? [],
    lastSeen: asIso(row.last_seen),
  };
}

export async function listWorkplaceCampuses(): Promise<string[]> {
  const sql = getPostgresSql();
  if (!sql) return [];
  const rows = await sql<{ campus: string }[]>`
    select distinct campus
    from shared.people
    where campus is not null and campus <> ''
    order by campus
  `;
  return rows.map((row) => row.campus);
}
