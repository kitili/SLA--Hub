#!/usr/bin/env node
/**
 * Copy onboarding (and other desk) data into the Ops Supabase project schemas.
 * Does not change live Vercel/Railway apps. Writes gitignored .env files only.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

const ROOT = path.resolve(import.meta.dirname, "..");
const OPS_ENV = "/home/kiki/OPS_SYSTEM/.env.local";
const TARGET_SCHEMA = "onboarding";

function loadEnvFile(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function upsertEnv(file, updates) {
  const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
  const keys = new Set();
  const lines = existing
    ? existing.split("\n").map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return line;
        const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
        if (key in updates) {
          keys.add(key);
          return `${key}=${updates[key]}`;
        }
        return line;
      })
    : [];
  for (const [key, value] of Object.entries(updates)) {
    if (!keys.has(key)) lines.push(`${key}=${value}`);
  }
  if (lines.length && lines.at(-1) !== "") lines.push("");
  writeFileSync(file, lines.join("\n"));
}

function redact(text, secret) {
  return secret ? text.split(secret).join("[secret]") : text;
}

function rewritePublic(sql, schema) {
  return sql.replaceAll('"public".', `"${schema}".`).replaceAll(/\bpublic\./g, `${schema}.`);
}

async function copyOnboarding(sql) {
  const pg = new PGlite(path.join(ROOT, ".pglite"));
  await pg.waitReady;

  await sql.unsafe(`
    drop schema if exists ${TARGET_SCHEMA} cascade;
    create schema ${TARGET_SCHEMA};
    grant usage, create on schema ${TARGET_SCHEMA} to postgres, service_role;
    set search_path to ${TARGET_SCHEMA}, public;
  `);

  const enums = await pg.query(`
    select t.typname,
           array(select enumlabel from pg_enum e where e.enumtypid = t.oid order by e.enumsortorder) as labels
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  `);
  for (const row of enums.rows) {
    const labels = row.labels.map((l) => `'${String(l).replaceAll("'", "''")}'`).join(", ");
    await sql.unsafe(`do $$ begin create type ${TARGET_SCHEMA}.${row.typname} as enum (${labels}); exception when duplicate_object then null; end $$;`);
  }

  const tables = (
    await pg.query(`
      select c.relname as name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `)
  ).rows.map((r) => r.name);

  for (const table of tables) {
    const cols = await pg.query(
      `
      select a.attname as name,
             pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
             a.attnotnull as notnull,
             pg_get_expr(ad.adbin, ad.adrelid) as def
      from pg_attribute a
      left join pg_attrdef ad on a.attrelid = ad.adrelid and a.attnum = ad.adnum
      where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped
      order by a.attnum
    `,
      [table],
    );
    const colSql = cols.rows
      .map((col) => {
        const type = rewritePublic(col.type, TARGET_SCHEMA).replace(
          /\bsection_item_type\b/g,
          `${TARGET_SCHEMA}.section_item_type`,
        );
        const def = col.def ? ` default ${rewritePublic(col.def, TARGET_SCHEMA)}` : "";
        const nulls = col.notnull ? " not null" : "";
        return `"${col.name}" ${type}${def}${nulls}`;
      })
      .join(",\n  ");
    await sql.unsafe(`create table ${TARGET_SCHEMA}."${table}" (\n  ${colSql}\n)`);
  }

  await sql.unsafe("set session_replication_role = replica");
  for (const table of tables) {
    const quoted = `"${table}"`;
    const count = await pg.query(`select count(*)::int as n from ${quoted}`);
    const n = count.rows[0].n;
    if (n === 0) {
      console.log(`  ${table}: 0`);
      continue;
    }
    const rows = await pg.query(`select * from ${quoted}`);
    const columns = Object.keys(rows.rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");
    const chunk = 200;
    for (let i = 0; i < rows.rows.length; i += chunk) {
      const slice = rows.rows.slice(i, i + chunk);
      const values = slice
        .map((row) => {
          const cells = columns.map((c) => {
            const v = row[c];
            if (v === null || v === undefined) return "NULL";
            if (v instanceof Date) return `'${v.toISOString()}'`;
            if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
            if (typeof v === "number") return String(v);
            if (typeof v === "object") return `'${JSON.stringify(v).replaceAll("'", "''")}'::jsonb`;
            return `'${String(v).replaceAll("'", "''")}'`;
          });
          return `(${cells.join(", ")})`;
        })
        .join(",\n");
      await sql.unsafe(`insert into ${TARGET_SCHEMA}.${quoted} (${colList}) values ${values}`);
    }
    console.log(`  ${table}: ${n}`);
  }
  await sql.unsafe("set session_replication_role = origin");

  const pks = await pg.query(`
    select conrelid::regclass::text as tbl, pg_get_constraintdef(oid) as def, conname
    from pg_constraint
    where connamespace = 'public'::regnamespace and contype = 'p'
  `);
  for (const row of pks.rows) {
    const table = row.tbl.replace(/^public\./, "").replaceAll('"', "");
    try {
      await sql.unsafe(
        `alter table ${TARGET_SCHEMA}."${table}" add constraint ${row.conname} ${rewritePublic(row.def, TARGET_SCHEMA)}`,
      );
    } catch (err) {
      if (!/already exists/i.test(err.message)) console.warn("pk", table, err.message.slice(0, 120));
    }
  }

  const others = await pg.query(`
    select conrelid::regclass::text as tbl, pg_get_constraintdef(oid) as def, conname, contype
    from pg_constraint
    where connamespace = 'public'::regnamespace and contype <> 'p'
    order by case contype when 'u' then 0 when 'f' then 1 else 2 end
  `);
  for (const row of others.rows) {
    const table = row.tbl.replace(/^public\./, "").replaceAll('"', "");
    try {
      await sql.unsafe(
        `alter table ${TARGET_SCHEMA}."${table}" add constraint ${row.conname} ${rewritePublic(row.def, TARGET_SCHEMA)}`,
      );
    } catch (err) {
      if (!/already exists/i.test(err.message)) console.warn("con", table, row.conname, err.message.slice(0, 140));
    }
  }

  const indexes = await pg.query(`
    select pg_get_indexdef(i.oid) as def
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and not x.indisprimary
  `);
  for (const row of indexes.rows) {
    try {
      await sql.unsafe(rewritePublic(row.def, TARGET_SCHEMA));
    } catch (err) {
      if (!/already exists/i.test(err.message)) console.warn("idx", err.message.slice(0, 140));
    }
  }

  await pg.close();
}

function loadDirectoryPeople() {
  const file = "/home/kiki/school-erp/prisma/data/silverleaf-staff.json";
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, "utf8"));
}

async function upsertExtraPeople(sql) {
  const extras = [];
  const jsonPeople = loadDirectoryPeople();
  for (const person of jsonPeople) {
    const email = String(person.email || "").trim().toLowerCase();
    if (!email) continue;
    extras.push({
      email,
      name: `${person.firstName || ""} ${person.lastName || ""}`.trim() || email,
      title: person.position || null,
      campus: null,
    });
  }
  try {
    const sqlite = await import("node:sqlite");
    void sqlite;
  } catch {
    // optional
  }
  const hubSqlite = path.join(ROOT, "data/hub.sqlite");
  if (existsSync(hubSqlite)) {
    const { default: Database } = await import("better-sqlite3").catch(() => ({ default: null }));
    if (Database) {
      const db = new Database(hubSqlite, { readonly: true });
      for (const row of db.prepare("select email, full_name from staff").all()) {
        extras.push({
          email: String(row.email).toLowerCase(),
          name: row.full_name || String(row.email),
          title: null,
          campus: null,
        });
      }
      db.close();
    }
  }

  let added = 0;
  for (const person of extras) {
    const result = await sql.unsafe(
      `
      insert into ${TARGET_SCHEMA}.staff (email, full_name, job_title, campus, is_admin)
      values ('${person.email.replaceAll("'", "''")}', '${person.name.replaceAll("'", "''")}',
              ${person.title ? `'${person.title.replaceAll("'", "''")}'` : "null"},
              ${person.campus ? `'${person.campus.replaceAll("'", "''")}'` : "null"},
              false)
      on conflict (email) do update set
        full_name = case when ${TARGET_SCHEMA}.staff.full_name = '' then excluded.full_name else ${TARGET_SCHEMA}.staff.full_name end,
        job_title = coalesce(${TARGET_SCHEMA}.staff.job_title, excluded.job_title)
      `,
    );
    void result;
    added += 1;
  }
  const count = await sql.unsafe(`select count(*)::int as n from ${TARGET_SCHEMA}.staff`);
  console.log(`staff after directory merge: ${count[0].n} (processed ${added} extra rows)`);
}

function pgDumpIntoSchema(sourceUrl, schema, label) {
  if (!sourceUrl) {
    console.log(`skip ${label}: no url`);
    return;
  }
  console.log(`dumping ${label} -> ${schema}`);
  const dump = spawnSync("pg_dump", ["--no-owner", "--no-acl", "--schema=public", sourceUrl], {
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
  if (dump.status !== 0) {
    console.warn(`  ${label} dump failed:`, redact(dump.stderr || "", sourceUrl).slice(0, 240));
    return;
  }
  let sqlText = dump.stdout
    .split("\n")
    .filter((line) => !/^CREATE SCHEMA public/i.test(line) && !/^ALTER SCHEMA public/i.test(line) && !/^CREATE EXTENSION/i.test(line))
    .join("\n");
  sqlText = `drop schema if exists ${schema} cascade;\ncreate schema ${schema};\ngrant usage, create on schema ${schema} to postgres, service_role;\n${rewritePublic(sqlText, schema)}`;
  const ops = loadEnvFile(OPS_ENV).DATABASE_URL;
  const apply = spawnSync("psql", [ops, "-v", "ON_ERROR_STOP=0", "-q"], {
    input: sqlText,
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
  if (apply.stderr) console.warn(redact(apply.stderr, ops).slice(0, 400));
  console.log(`  ${label} restore exit ${apply.status}`);
}

async function loadVisitors(sql) {
  const dbPath = path.join(ROOT, "desks/visitors/data/visits.db");
  if (!existsSync(dbPath)) {
    console.log("skip visitors sqlite");
    return;
  }
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare("select * from visits").all();
  db.close();
  await sql.unsafe(`
    create table if not exists visitors.visits (
      id text primary key,
      name text not null,
      phone text not null,
      purpose text not null,
      host text not null,
      campus text not null,
      date text not null,
      photo text,
      source text not null,
      signed_in_at text not null,
      signed_out_at text
    )
  `);
  await sql.unsafe("truncate visitors.visits");
  for (const row of rows) {
    const esc = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);
    await sql.unsafe(`
      insert into visitors.visits (id, name, phone, purpose, host, campus, date, photo, source, signed_in_at, signed_out_at)
      values (${esc(row.id)}, ${esc(row.name)}, ${esc(row.phone)}, ${esc(row.purpose)}, ${esc(row.host)},
              ${esc(row.campus)}, ${esc(row.date)}, ${esc(row.photo)}, ${esc(row.source)},
              ${esc(row.signed_in_at)}, ${esc(row.signed_out_at)})
    `);
  }
  console.log(`visitors: ${rows.length}`);
}

async function refreshSharedPeople(sql) {
  await sql.unsafe(`
    create schema if not exists shared;
    grant usage on schema shared to postgres, service_role, authenticated, anon;
    create table if not exists shared.people (
      email text primary key,
      full_name text not null,
      job_title text,
      campus text,
      apps text[] not null default '{}',
      last_seen timestamptz
    );
    grant select on shared.people to authenticated, service_role, postgres;
    truncate shared.people;
  `);

  const inserts = [
    `insert into shared.people (email, full_name, job_title, campus, apps, last_seen)
     select lower(email), coalesce(nullif(full_name,''), email), job_title, campus, array['onboarding']::text[], last_active_at
     from onboarding.staff
     on conflict (email) do update set
       full_name = excluded.full_name,
       job_title = coalesce(shared.people.job_title, excluded.job_title),
       campus = coalesce(shared.people.campus, excluded.campus),
       apps = (select array(select distinct unnest(shared.people.apps || excluded.apps))),
       last_seen = greatest(shared.people.last_seen, excluded.last_seen)`,
  ];

  const optional = [
    [
      "ops",
      `select lower(u.email), coalesce(p.full_name, u.email), p.role::text, null::text, array['ops']::text[], p.updated_at
       from auth.users u join public.profiles p on p.id = u.id where u.email is not null`,
    ],
    [
      "data_tech",
      `select lower(email), name, role::text, null::text, array['data_tech']::text[], updated_at from data_tech.users`,
    ],
    [
      "uniforms",
      `select lower(email), name, role, null::text, array['uniforms']::text[], created_at from uniforms."User"`,
    ],
    [
      "workboard",
      `select lower(coalesce(email, phone)), coalesce(name, phone), role::text, null::text, array['workboard']::text[], "updatedAt" from workboard."User"`,
    ],
    [
      "marketing",
      `select lower(email), coalesce(full_name, name, email), null::text, null::text, array['marketing']::text[], created_at from marketing.users`,
    ],
    [
      "talent",
      `select lower(email), coalesce(name, email), null::text, null::text, array['talent']::text[], created_at from talent.users`,
    ],
    [
      "visitors",
      `select lower(host), host, null::text, campus, array['visitors']::text[], signed_in_at
       from visitors.visits
       where host ~* '@[a-z0-9.-]+\\.[a-z]{2,}'`,
    ],
  ];

  for (const sqlText of inserts) {
    await sql.unsafe(sqlText);
  }
  for (const [label, selectSql] of optional) {
    try {
      await sql.unsafe(`
        insert into shared.people (email, full_name, job_title, campus, apps, last_seen)
        ${selectSql}
        on conflict (email) do update set
          apps = (select array(select distinct unnest(shared.people.apps || excluded.apps))),
          last_seen = greatest(shared.people.last_seen, excluded.last_seen),
          full_name = case when shared.people.full_name ~* '@' then excluded.full_name else shared.people.full_name end
      `);
      console.log(`shared.people merged ${label}`);
    } catch (err) {
      console.log(`shared.people skip ${label}:`, err.message.slice(0, 140));
    }
  }
  const n = await sql`select count(*)::int as n from shared.people`;
  console.log(`shared.people: ${n[0].n}`);
}

async function mergeMarketingExport(sql) {
  const file = path.join(ROOT, "data/marketing-live-export/tables/users.json");
  if (!existsSync(file)) {
    console.log("skip marketing export");
    return;
  }
  const users = JSON.parse(readFileSync(file, "utf8"));
  let merged = 0;
  for (const user of users) {
    const email = String(user.email || "")
      .trim()
      .toLowerCase();
    if (!email.includes("@")) continue;
    const fullName = String(user.name || email).trim() || email;
    const jobTitle = user.role ? String(user.role) : null;
    await sql`
      insert into shared.people (email, full_name, job_title, apps)
      values (${email}, ${fullName}, ${jobTitle}, array['marketing']::text[])
      on conflict (email) do update set
        apps = (select array(select distinct unnest(shared.people.apps || excluded.apps))),
        job_title = coalesce(shared.people.job_title, excluded.job_title)
    `;
    merged += 1;
  }
  console.log(`shared.people marketing export: ${merged}`);
}

function envUrl(file, ...keys) {
  const env = loadEnvFile(file);
  for (const key of keys) {
    if (env[key]?.startsWith("postgres")) return env[key];
  }
  return "";
}

async function main() {
  const ops = loadEnvFile(OPS_ENV);
  if (!ops.DATABASE_URL) throw new Error("OPS_SYSTEM .env.local missing DATABASE_URL");

  const sql = postgres(ops.DATABASE_URL, { prepare: false, max: 1 });

  console.log("1. onboarding PGlite -> ops.onboarding");
  await copyOnboarding(sql);
  await upsertExtraPeople(sql);

  console.log("2. other systems (best-effort dumps)");
  pgDumpIntoSchema(envUrl("/home/kiki/silverleaf-uniforms/.env", "DIRECT_URL", "DATABASE_URL"), "uniforms", "uniforms");
  pgDumpIntoSchema(
    envUrl("/home/kiki/Documents/marketing-and-student-experience-main/backend/.env", "DATABASE_URL"),
    "marketing",
    "marketing",
  );
  pgDumpIntoSchema(
    envUrl("/home/kiki/Talent_Academy/Silverleaf-main/.env.local", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"),
    "talent",
    "talent",
  );
  pgDumpIntoSchema(
    envUrl("/home/kiki/Downloads/silverleaf-lesson-plans-main/.env.local", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"),
    "lesson_plans",
    "lesson-plans",
  );
  pgDumpIntoSchema("postgresql:///dataandtech", "data_tech", "data-tech");
  pgDumpIntoSchema(envUrl("/home/kiki/whatsapp-daily5/.env", "DATABASE_URL") || "postgresql:///daily5", "workboard", "workboard");
  await loadVisitors(sql);

  console.log("3. shared.people");
  await refreshSharedPeople(sql);
  await mergeMarketingExport(sql);

  console.log("4. write .env (gitignored)");
  const hubUpdates = {
    NEXT_PUBLIC_SUPABASE_URL: ops.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ops.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: ops.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: ops.DATABASE_URL,
    DATABASE_SEARCH_PATH: "onboarding",
    WORKPLACE_DATABASE_URL: ops.DATABASE_URL,
  };
  upsertEnv(path.join(ROOT, ".env.local"), hubUpdates);
  upsertEnv(path.join(ROOT, ".env"), hubUpdates);
  upsertEnv(path.join(ROOT, "desks/ops/.env.local"), {
    NEXT_PUBLIC_SUPABASE_URL: ops.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ops.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: ops.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: ops.DATABASE_URL,
    TICKETING_SUPABASE_URL: ops.TICKETING_SUPABASE_URL || ops.NEXT_PUBLIC_SUPABASE_URL,
    TICKETING_SUPABASE_ANON_KEY: ops.TICKETING_SUPABASE_ANON_KEY || ops.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  upsertEnv(path.join(ROOT, "desks/data-tech/.env.local"), {
    WORKPLACE_DATABASE_URL: ops.DATABASE_URL,
  });
  upsertEnv(path.join(ROOT, "desks/onboarding/.env.local"), {
    DATABASE_URL: ops.DATABASE_URL,
    DATABASE_SEARCH_PATH: "onboarding",
    WORKPLACE_DATABASE_URL: ops.DATABASE_URL,
  });

  await sql.end();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
