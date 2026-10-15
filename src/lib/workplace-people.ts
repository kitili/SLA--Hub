import "server-only";

import { sql as dsql } from "drizzle-orm";

import { db, getPostgresSql } from "@/lib/db/client";

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

function mapPerson(row: {
  email: string;
  full_name: string;
  job_title: string | null;
  campus: string | null;
  apps: string[] | null;
  last_seen: Date | string | null;
}): WorkplacePerson {
  return {
    email: row.email,
    fullName: row.full_name,
    jobTitle: row.job_title,
    campus: row.campus,
    apps: row.apps ?? [],
    lastSeen: asIso(row.last_seen),
  };
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
  try {
    return await listWorkplacePeopleStrict(filter);
  } catch {
    return [];
  }
}

/** Same as listWorkplacePeople, but surfaces database failures to API callers. */
export async function listWorkplacePeopleStrict(
  filter: WorkplacePeopleFilter = {},
): Promise<WorkplacePerson[]> {
  const campus = filter.campus?.trim();
  const app = filter.app?.trim();
  const q = filter.q?.trim();
  const since = filter.since ?? null;
  const limit = filter.limit ?? 500;
  const offset = filter.offset ?? 0;

  const postgres = getPostgresSql();
  if (postgres) {
    const clauses = [];
    if (filter.emailOnly) clauses.push(postgres`email like ${"%@%"}`);
    if (campus) clauses.push(postgres`campus ilike ${campus}`);
    if (app) clauses.push(postgres`${app} = any(apps)`);
    if (q) {
      const like = `%${q}%`;
      clauses.push(postgres`(full_name ilike ${like} or email ilike ${like})`);
    }
    if (since) clauses.push(postgres`last_seen >= ${since}`);
    const where = clauses.length
      ? clauses.reduce((left, right) => postgres`${left} and ${right}`)
      : postgres`true`;
    const rows = await postgres<
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
    return rows.map(mapPerson);
  }

  // PGlite / drizzle path for local hub verification.
  const clauses = [dsql`true`];
  if (filter.emailOnly) clauses.push(dsql`email like ${"%@%"}`);
  if (campus) clauses.push(dsql`campus ilike ${campus}`);
  if (app) clauses.push(dsql`${app} = any(apps)`);
  if (q) {
    const like = `%${q}%`;
    clauses.push(dsql`(full_name ilike ${like} or email ilike ${like})`);
  }
  if (since) clauses.push(dsql`last_seen >= ${since}`);
  const where = clauses.reduce((left, right) => dsql`${left} and ${right}`);
  const result = await db.execute(dsql`
    select email, full_name, job_title, campus, apps, last_seen
    from shared.people
    where ${where}
    order by full_name, email
    limit ${limit}
    offset ${offset}
  `);
  const rows = (Array.isArray(result) ? result : result.rows ?? []) as {
    email: string;
    full_name: string;
    job_title: string | null;
    campus: string | null;
    apps: string[];
    last_seen: Date | string | null;
  }[];
  return rows.map(mapPerson);
}

export async function getWorkplacePerson(email: string): Promise<WorkplacePerson | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;

  const postgres = getPostgresSql();
  if (postgres) {
    const [row] = await postgres<
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
    return row ? mapPerson(row) : null;
  }

  const result = await db.execute(dsql`
    select email, full_name, job_title, campus, apps, last_seen
    from shared.people
    where email = ${needle}
    limit 1
  `);
  const rows = (Array.isArray(result) ? result : result.rows ?? []) as {
    email: string;
    full_name: string;
    job_title: string | null;
    campus: string | null;
    apps: string[];
    last_seen: Date | string | null;
  }[];
  return rows[0] ? mapPerson(rows[0]) : null;
}

export async function listWorkplaceCampuses(): Promise<string[]> {
  const postgres = getPostgresSql();
  if (postgres) {
    const rows = await postgres<{ campus: string }[]>`
      select distinct campus
      from shared.people
      where campus is not null and campus <> ''
      order by campus
    `;
    return rows.map((row) => row.campus);
  }

  const result = await db.execute(dsql`
    select distinct campus
    from shared.people
    where campus is not null and campus <> ''
    order by campus
  `);
  const rows = (Array.isArray(result) ? result : result.rows ?? []) as { campus: string }[];
  return rows.map((row) => row.campus);
}
