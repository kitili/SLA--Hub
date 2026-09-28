import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SettingsPanel } from "@/components/admin/SettingsPanel";
import AdminRosterCard from "@/components/admin/AdminRosterCard";

export const metadata: Metadata = {
  title: "Settings — Silverleaf Onboarding Hub",
  description: "Configure system settings for the Silverleaf Onboarding Hub.",
};
import { getAllSettings } from "@/lib/app-settings";
import { getMemberMonitorOverview } from "@/lib/db/queries/admin";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getTranslations("admin");
  const [settings, overview] = await Promise.all([
    getAllSettings(),
    getMemberMonitorOverview(),
  ]);

  const rosterMembers = overview.members.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    email: m.email,
    campus: m.campus,
    isAdmin: m.isAdmin,
  }));

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("settings")}</h1>
        <p className={styles.muted}>Configure system-wide settings.</p>
      </div>
      <SettingsPanel initialSettings={settings} />
      <AdminRosterCard initialMembers={rosterMembers} />
    </>
  );
}
