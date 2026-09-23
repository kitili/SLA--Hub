import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listAccessEvents, countRecentSignIns } from "@/lib/db/repositories/access";
import ActivityLog from "@/components/ActivityLog";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = {
  title: "Workplace activity",
};

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const t = await getTranslations("admin.activity");
  const [events, signInsToday] = await Promise.all([
    listAccessEvents(120),
    countRecentSignIns(24),
  ]);

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("heading")}</h1>
        <p>{t("description")}</p>
      </div>
      <ActivityLog
        embedded
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
    </>
  );
}
