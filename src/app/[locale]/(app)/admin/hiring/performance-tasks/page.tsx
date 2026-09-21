import type { Metadata } from "next";
import { desc } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Performance Tasks — Silverleaf Onboarding Hub",
  description: "Manage candidate assessment tasks for the hiring process.",
};

import adminStyles from "@/components/admin/admin.module.css";
import {
  PerformanceTasksPanel,
  type PerformanceTask,
} from "@/components/hiring/PerformanceTasksPanel";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db/client";
import { hiringPerformanceTasks } from "@/lib/db/schema/hiring";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PerformanceTasksAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;

  const admin = await requireAdminApi();
  if (!admin) {
    redirect("/sign-in");
  }

  const rows = await db
    .select({
      id: hiringPerformanceTasks.id,
      title: hiringPerformanceTasks.title,
      description: hiringPerformanceTasks.description,
      fileLink: hiringPerformanceTasks.fileLink,
      managerEmail: hiringPerformanceTasks.managerEmail,
      isActive: hiringPerformanceTasks.isActive,
    })
    .from(hiringPerformanceTasks)
    .orderBy(desc(hiringPerformanceTasks.createdAt));

  const tasks: PerformanceTask[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    fileLink: r.fileLink,
    managerEmail: r.managerEmail,
    isActive: r.isActive,
  }));

  return (
    <>
      <div className={adminStyles.pageHeader}>
        <h1>Performance Tasks</h1>
        <p>
          Manage reusable performance task templates sent to candidates during
          the hiring pipeline.
        </p>
        <p className={adminStyles.muted}>
          <Link href="/admin/hiring" className={adminStyles.link}>
            &larr; Back to hiring board
          </Link>
        </p>
      </div>

      <PerformanceTasksPanel initialTasks={tasks} />
    </>
  );
}
