import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/identity";
import styles from "@/components/admin/admin.module.css";
import { SheetImportClient } from "@/components/admin/SheetImportClient";
import { SheetStats } from "@/components/admin/SheetStats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import Candidates — Silverleaf Onboarding Hub",
  description: "Import job applicants from the Google Form into the hiring pipeline.",
};

export default async function SheetImportPage() {
  await requireAdmin();

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Import from application form</h1>
        <p className={styles.muted}>
          Search candidates from the Google Form responses, then import them into the hiring pipeline.
        </p>
      </div>
      <SheetStats />
      <SheetImportClient />
    </>
  );
}
