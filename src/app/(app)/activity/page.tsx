import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listAccessEvents, countRecentSignIns } from "@/lib/db/repositories/access";
import ActivityLog from "@/components/ActivityLog";

export const metadata: Metadata = {
  title: "Who is in the workplace",
};

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/hub");

  const [events, signInsToday] = await Promise.all([
    listAccessEvents(120),
    countRecentSignIns(24),
  ]);

  return (
    <ActivityLog
      signInsToday={signInsToday}
      events={events.map((event) => ({
        id: event.id,
        name: event.fullName,
        email: event.email,
        action: event.action,
        part: event.departmentName,
        path: event.path,
        at: event.createdAt.toISOString(),
      }))}
    />
  );
}
