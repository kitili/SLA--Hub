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

export async function listWorkplacePeople(): Promise<WorkplacePerson[]> {
  const sql = getPostgresSql();
  if (!sql) return [];
  const rows = await sql<
    {
      email: string;
      full_name: string;
      job_title: string | null;
      campus: string | null;
      apps: string[];
      last_seen: Date | null;
    }[]
  >`
    select email, full_name, job_title, campus, apps, last_seen
    from shared.people
    order by full_name, email
  `;
  return rows.map((row) => ({
    email: row.email,
    fullName: row.full_name,
    jobTitle: row.job_title,
    campus: row.campus,
    apps: row.apps ?? [],
    lastSeen: row.last_seen ? row.last_seen.toISOString() : null,
  }));
}
