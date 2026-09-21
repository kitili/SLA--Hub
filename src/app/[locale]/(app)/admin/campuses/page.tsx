import type { Metadata } from "next";
import { listCampuses } from "@/lib/db/queries/admin";

export const metadata: Metadata = {
  title: "Campuses — Silverleaf Onboarding Hub",
  description: "Manage Silverleaf Academy campus locations.",
};
import CampusesPanel from "@/components/admin/CampusesPanel";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

/** Campus management — list existing campuses and add new ones. */
export default async function AdminCampusesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const campuses = await listCampuses();

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Campuses</h1>
        <p>Manage the campus list used to categorise staff members.</p>
      </div>

      <CampusesPanel
        campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
      />
    </>
  );
}
