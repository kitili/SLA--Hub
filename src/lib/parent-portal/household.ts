import "server-only";

import { getPostgresSql } from "@/lib/db/client";

export type PortalUniform = {
  ref: string;
  status: string;
};

export type PortalChild = {
  id: string;
  name: string;
  grade: string;
  school: string;
  active: boolean;
  boarding: string;
  fee: string;
  uniforms: PortalUniform[];
};

export type PortalHousehold = {
  children: PortalChild[];
};

/** Last 9 digits of the Tanzanian number, after +255 and a leading 0 are removed. */
export function phoneKey(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length >= 12) digits = digits.slice(3);
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

type ParentRow = { id: string };
type ChildRow = {
  id: string;
  first_name: string;
  last_name: string;
  class_name: string | null;
  school: string | null;
  active: boolean;
};
type BoardRow = {
  student_id: string;
  bus: string | null;
  direction: string;
  event_type: string;
  scanned_at: string;
};
type FeeRow = { student_id: string; balance: string; currency: string };
type UniformRow = { ref: string; status: string; student_name: string };

function money(balance: string, currency: string) {
  const amount = Number(balance);
  if (!Number.isFinite(amount)) return "No fee record yet.";
  const formatted = new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 }).format(amount);
  if (amount <= 0) return "Nothing outstanding on the fee record.";
  return `${currency || "TZS"} ${formatted} still on the fee record.`;
}

function boardingLine(rows: BoardRow[]) {
  if (rows.length === 0) return "No boarding recorded today.";
  const latest = rows[0];
  const when = new Intl.DateTimeFormat("en-TZ", {
    timeZone: "Africa/Nairobi",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(latest.scanned_at));
  const way = latest.direction === "am" ? "morning" : latest.direction === "pm" ? "afternoon" : latest.direction;
  const verb = latest.event_type === "in" ? "Boarded" : "Dropped off";
  const bus = latest.bus ? ` · ${latest.bus}` : "";
  return `${verb} ${way}${bus} · ${when}`;
}

export async function findParentIds(key: string): Promise<string[] | null> {
  const sql = getPostgresSql();
  if (!sql) return null;
  const rows = await sql<ParentRow[]>`
    select id::text as id
    from public.parents
    where right(
      case
        when regexp_replace(phone, '[^0-9]', '', 'g') like '255%'
          and length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 12
          then regexp_replace(substring(regexp_replace(phone, '[^0-9]', '', 'g') from 4), '^0+', '')
        else regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'), '^0+', '')
      end,
      9
    ) = ${key}
    limit 5
  `;
  return rows.map((row) => row.id);
}

export async function loadHousehold(parentIds: string[]): Promise<PortalHousehold | null> {
  const sql = getPostgresSql();
  if (!sql || parentIds.length === 0) return null;

  const children = await sql<ChildRow[]>`
    select s.id::text as id,
           s.first_name,
           s.last_name,
           s.class_name,
           sc.name as school,
           s.active
    from public.student_parents sp
    join public.students s on s.id = sp.student_id
    join public.schools sc on sc.id = s.school_id
    where sp.parent_id::text in ${sql(parentIds)}
    order by s.active desc, s.first_name, s.last_name
  `;

  if (children.length === 0) return { children: [] };

  const ids = children.map((child) => child.id);
  const [boarding, fees, uniforms] = await Promise.all([
    sql<BoardRow[]>`
      select e.student_id::text as student_id,
             b.label as bus,
             t.direction,
             e.event_type,
             e.scanned_at::text as scanned_at
      from public.boarding_events e
      join public.trips t on t.id = e.trip_id
      join public.buses b on b.id = t.bus_id
      where e.student_id::text in ${sql(ids)}
        and t.trip_date = (now() at time zone 'Africa/Nairobi')::date
      order by e.scanned_at desc
    `.catch(() => [] as BoardRow[]),
    sql<FeeRow[]>`
      select student_id::text as student_id, balance::text as balance, currency
      from public.fee_balances
      where student_id::text in ${sql(ids)}
    `.catch(() => [] as FeeRow[]),
    loadUniforms(children).catch(() => [] as UniformRow[]),
  ]);

  return {
    children: children.map((child) => {
      const name = `${child.first_name} ${child.last_name}`.trim();
      const fee = fees.find((row) => row.student_id === child.id);
      return {
        id: child.id,
        name,
        grade: child.class_name?.trim() || "Class not recorded",
        school: child.school?.trim() || "Silverleaf",
        active: child.active,
        boarding: boardingLine(boarding.filter((row) => row.student_id === child.id)),
        fee: fee ? money(fee.balance, fee.currency) : "No fee record yet.",
        uniforms: uniforms
          .filter((row) => row.student_name.trim().toLowerCase() === name.toLowerCase())
          .slice(0, 3)
          .map((row) => ({ ref: row.ref, status: row.status })),
      };
    }),
  };
}

async function loadUniforms(children: ChildRow[]): Promise<UniformRow[]> {
  const sql = getPostgresSql();
  if (!sql) return [];
  const names = children.map((child) => `${child.first_name} ${child.last_name}`.trim());
  return sql<UniformRow[]>`
    select ref, status, "studentName" as student_name
    from uniforms."ParentOrder"
    where lower("studentName") in ${sql(names.map((name) => name.toLowerCase()))}
    order by "orderedAt" desc
    limit 12
  `;
}
