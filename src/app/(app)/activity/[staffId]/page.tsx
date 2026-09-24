import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { parseAccessQuery } from "@/lib/access-query";
import { buildAccessSessions, summarizeAccessPeople } from "@/lib/access-summary";
import {
  countRecentSignIns,
  listAccessPeople,
  listAccessWindow,
  queryAccessEvents,
} from "@/lib/db/repositories/access";
import ActivityLog from "@/components/ActivityLog";

export const metadata: Metadata = {
  title: "Staff workplace record",
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

export default async function ActivityPersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ staffId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/hub");

  const { staffId } = await params;
  const query = { ...parseAccessQuery(await searchParams), staffId };
  const [page, windowRows, signInsToday, personOptions] = await Promise.all([
    queryAccessEvents(query),
    listAccessWindow(query),
    countRecentSignIns(24),
    listAccessPeople(),
  ]);
  const windowEvents = toRows(windowRows);
  const [person] = summarizeAccessPeople(windowEvents);
  if (!person && page.total === 0) notFound();

  return (
    <ActivityLog
      query={query}
      signInsToday={signInsToday}
      eventTotal={page.total}
      personOptions={personOptions}
      people={person ? [person] : []}
      sessions={buildAccessSessions(windowEvents)}
      events={toRows(page.rows)}
      person={person ?? {
        staffId,
        name: "Staff",
        email: "",
        lastSeenAt: query.to,
        lastSignInAt: null,
        lastDesk: null,
        desks: [],
        deskVisits: 0,
        signIns: 0,
        eventCount: 0,
      }}
    />
  );
}
