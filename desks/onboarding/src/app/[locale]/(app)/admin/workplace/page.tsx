import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { listWorkplacePeople } from "@/lib/workplace-people";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = {
  title: "Everyone — Silverleaf Onboarding Hub",
};

export const dynamic = "force-dynamic";

const APP_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  ops: "Ops",
  data_tech: "Data & Tech",
  workboard: "Workboard",
  uniforms: "Uniforms",
  marketing: "Marketing",
  talent: "Talent Academy",
  visitors: "Visitors",
  lesson_plans: "Lesson Plans",
  mel: "MEL",
};

export default async function AdminWorkplacePage() {
  const t = await getTranslations("admin.workplace");
  const people = await listWorkplacePeople();

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("heading")}</h1>
        <p>{t("description")}</p>
        <p className={styles.muted}>{people.length} people across workplace apps.</p>
      </div>
      {people.length === 0 ? (
        <p className={styles.muted}>
          No shared people yet. Set WORKPLACE_DATABASE_URL or DATABASE_URL to the Ops
          database.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Campus</th>
                <th>Apps</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.email}>
                  <td className={styles.nameCell}>{person.fullName}</td>
                  <td>{person.email}</td>
                  <td>{person.jobTitle || "—"}</td>
                  <td>{person.campus || "—"}</td>
                  <td>{person.apps.map((app) => APP_LABEL[app] ?? app).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
