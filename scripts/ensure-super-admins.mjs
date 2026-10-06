#!/usr/bin/env node
/**
 * Promote Krupa Patel and Nelly Zablon as admin in every loaded workplace
 * schema. Does not create Ops auth.users (live Ops login is still Supabase).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createHash } from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const SUPER_ADMINS = [
  { email: "krupa@silverleaf.co.tz", name: "Krupa Patel", title: "CEO", phone: "+255700000001" },
  { email: "nelly@silverleaf.co.tz", name: "Nelly Zablon", title: "Director of Schools", phone: "+255700000002" },
];

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return process.env;
  const env = { ...process.env };
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function dummyHash(email) {
  return createHash("sha256").update(`sla-super-admin:${email}`).digest("hex");
}

async function main() {
  const env = loadEnv();
  const url = env.WORKPLACE_DATABASE_URL || env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { prepare: false, connection: { search_path: "onboarding" }, max: 1 });

  for (const person of SUPER_ADMINS) {
    await sql`
      update onboarding.staff
      set is_admin = true, full_name = ${person.name}, job_title = ${person.title}
      where email = ${person.email}
    `;
    const hash = dummyHash(person.email);
    await sql`
      insert into data_tech.users (name, email, password_hash, role, department_id, is_active, must_change_password)
      values (
        ${person.name},
        ${person.email},
        ${hash},
        'admin',
        (select id from data_tech.departments where name = 'Data & Tech' limit 1),
        true,
        true
      )
      on conflict (email) do update set
        name = excluded.name,
        role = 'admin',
        is_active = true
    `;
    const org = await sql`select id from workboard."Organization" limit 1`;
    if (org[0]) {
      await sql`
        insert into workboard."User" (id, "organizationId", phone, email, name, "jobTitle", role, "isActive", "createdAt", "updatedAt")
        values (
          ${`superadmin-${person.email.split("@")[0]}`},
          ${org[0].id},
          ${person.phone},
          ${person.email},
          ${person.name},
          ${person.title},
          'ADMIN',
          true,
          now(),
          now()
        )
        on conflict (email) do update set
          name = excluded.name,
          role = 'ADMIN',
          "isActive" = true,
          "jobTitle" = excluded."jobTitle"
      `;
    }
    await sql`
      insert into shared.people (email, full_name, job_title, campus, apps, last_seen)
      values (
        ${person.email},
        ${person.name},
        ${person.title},
        'HQ',
        array['onboarding','ops','data_tech','workboard','uniforms','marketing','talent','visitors','lesson_plans','mel']::text[],
        now()
      )
      on conflict (email) do update set
        full_name = excluded.full_name,
        job_title = excluded.job_title,
        apps = (select array(select distinct unnest(shared.people.apps || excluded.apps))),
        last_seen = greatest(shared.people.last_seen, excluded.last_seen)
    `;
    console.log(`promoted ${person.email}`);
  }

  await sql.end({ timeout: 2 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
