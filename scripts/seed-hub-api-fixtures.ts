import { sql } from "drizzle-orm";

import { db } from "../src/lib/db/client";
import { staff } from "../src/lib/db/schema/staff";

async function main() {
  await db.execute(sql`create schema if not exists shared`);
  await db.execute(sql`
    create table if not exists shared.people (
      email text primary key,
      full_name text not null,
      job_title text,
      campus text,
      apps text[] not null default '{}',
      last_seen timestamptz
    )
  `);

  await db
    .insert(staff)
    .values({
      email: "amina.teacher@silverleaf.co.tz",
      fullName: "Amina Teacher",
      campus: "Main",
      jobTitle: "Teacher",
    })
    .onConflictDoNothing();

  await db.execute(sql`
    insert into shared.people (email, full_name, job_title, campus, apps, last_seen)
    values
      (
        'amina.teacher@silverleaf.co.tz',
        'Amina Teacher',
        'Teacher',
        'Main',
        array['onboarding'],
        now()
      ),
      (
        'baraka.ops@silverleaf.co.tz',
        'Baraka Ops',
        'Ops Lead',
        'Usa River',
        array['ops','onboarding'],
        now()
      )
    on conflict (email) do update set
      full_name = excluded.full_name,
      job_title = excluded.job_title,
      campus = excluded.campus,
      apps = excluded.apps,
      last_seen = excluded.last_seen
  `);

  const people = await db.execute(sql`
    select email, full_name, campus from shared.people order by email
  `);
  const staffRows = await db
    .select({ email: staff.email, fullName: staff.fullName, campus: staff.campus })
    .from(staff);

  console.log(
    JSON.stringify(
      {
        ok: true,
        people: "rows" in people ? people.rows : people,
        staff: staffRows,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
