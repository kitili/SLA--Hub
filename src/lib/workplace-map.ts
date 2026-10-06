import "server-only";

import { getPostgresSql } from "@/lib/db/client";
import { workplaceSystems, type WorkplaceSystem } from "@/lib/workplace-systems";

export type SystemSmoke = {
  ok: boolean;
  status: number;
  ms: number;
};

export type WorkplaceMapRow = WorkplaceSystem & {
  schemaComment: string | null;
  tableCount: number;
  tables: string[];
  smoke: SystemSmoke;
};

async function smokeUrl(url: string): Promise<SystemSmoke> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": "SLA-Hub-Smoke/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    return { ok: response.ok, status: response.status, ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - started };
  }
}

export async function getWorkplaceMap(): Promise<WorkplaceMapRow[]> {
  const sql = getPostgresSql();
  const stats = new Map<string, { comment: string | null; tables: number; names: string[] }>();

  if (sql) {
    const rows = await sql<
      { schema_name: string; comment: string | null; tables: number }[]
    >`
      select
        n.nspname as schema_name,
        obj_description(n.oid) as comment,
        (
          select count(*)::int
          from pg_class c
          where c.relnamespace = n.oid
            and c.relkind = 'r'
        ) as tables
      from pg_namespace n
      where n.nspname in (
        'public', 'shared', 'onboarding', 'marketing', 'data_tech', 'talent',
        'uniforms', 'visitors', 'workboard', 'lesson_plans', 'mel'
      )
    `;
    const tableRows = await sql<{ schema_name: string; table_name: string }[]>`
      select n.nspname as schema_name, c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname in (
          'public', 'shared', 'onboarding', 'marketing', 'data_tech', 'talent',
          'uniforms', 'visitors', 'workboard', 'lesson_plans', 'mel'
        )
      order by n.nspname, c.relname
    `;
    for (const row of rows) {
      stats.set(row.schema_name, {
        comment: row.comment,
        tables: row.tables,
        names: tableRows
          .filter((table) => table.schema_name === row.schema_name)
          .map((table) => table.table_name),
      });
    }
  }

  const smokes = await Promise.all(workplaceSystems.map((system) => smokeUrl(system.liveUrl)));

  return workplaceSystems.map((system, index) => {
    const stat = stats.get(system.schemaName);
    return {
      ...system,
      schemaComment: stat?.comment ?? null,
      tableCount: stat?.tables ?? 0,
      tables: stat?.names ?? [],
      smoke: smokes[index],
    };
  });
}
