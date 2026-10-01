import postgres from "postgres";
import { cache } from "react";

export type WorkplacePerson = {
  email: string;
  fullName: string;
  jobTitle: string | null;
  campus: string | null;
  apps: string[];
  lastSeen: string | null;
};

export const listWorkplacePeople = cache(async (): Promise<WorkplacePerson[]> => {
  const url = process.env.WORKPLACE_DATABASE_URL?.trim();
  if (!url) return [];
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
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
  } finally {
    await sql.end({ timeout: 1 });
  }
});
