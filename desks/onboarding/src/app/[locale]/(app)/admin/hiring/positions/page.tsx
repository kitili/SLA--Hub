import { db } from "@/lib/db/client";
import { jobOpenings } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/identity";
import styles from "@/components/admin/admin.module.css";
import { JobPositionsClient } from "@/components/admin/JobPositionsClient";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function PositionsPage() {
  await requireAdmin();

  const positions = await db
    .select({
      id: jobOpenings.id,
      title: jobOpenings.title,
      status: jobOpenings.status,
      createdAt: jobOpenings.createdAt,
    })
    .from(jobOpenings)
    .orderBy(asc(jobOpenings.createdAt));

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Job Positions</h1>
        <p className={styles.muted}>
          Manage the positions shown in the application form dropdown. Only active positions are visible to applicants.
        </p>
      </div>
      <JobPositionsClient initialPositions={positions} />
    </>
  );
}
