import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { parseAccessQuery } from "@/lib/access-query";
import { buildAccessSessions, summarizeAccessPeople } from "@/lib/access-summary";
import {
  countRecentSignIns,
  listAccessPeople,
  listAccessWindow,
  queryAccessEvents,
} from "@/lib/db/repositories/access";
import ActivityLog from "@/components/ActivityLog";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = {
  title: "Workplace activity",
};

export const dynamic = "force-dynamic";

function toRows(rows: Awaited<ReturnType<typeof listAccessWindow>>) {
  return rows.map((event) => ({
    id: event.id,
    staffId: event.staffId,
    name: event.fullName,
    email: event.email,
    action: event.action,
    part: event.departmentName,
    path: event.path,
    at: event.createdAt.toISOString(),
  }));
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("admin.activity");
  const query = parseAccessQuery(await searchParams);
  const [page, windowRows, signInsToday, personOptions] = await Promise.all([
    queryAccessEvents(query),
    listAccessWindow(query),
    countRecentSignIns(24),
    listAccessPeople(),
  ]);
  const windowEvents = toRows(windowRows);

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("heading")}</h1>
        <p>{t("description")}</p>
      </div>
      <ActivityLog
        embedded
        query={query}
        signInsToday={signInsToday}
        eventTotal={page.total}
        personOptions={personOptions}
        people={summarizeAccessPeople(windowEvents)}
        sessions={buildAccessSessions(windowEvents)}
        events={toRows(page.rows)}
      />
    </>
  );
}
