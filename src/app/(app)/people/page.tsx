import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listWorkplacePeople } from "@/lib/workplace-people";
import styles from "@/components/ActivityLog.module.css";

export const metadata: Metadata = {
  title: "Everyone in the workplace",
};

export const dynamic = "force-dynamic";

const APP_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  ops: "Ops",
  data_tech: "Data & Tech",
  workboard: "1–5’s",
  uniforms: "Uniforms",
  marketing: "Marketing",
  talent: "Talent Academy",
  visitors: "Visitors",
  lesson_plans: "Lesson Plans",
  mel: "MEL",
};

export default async function WorkplacePeoplePage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/hub");
  const people = await listWorkplacePeople();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>All systems</p>
        <h1>Everyone who has used a Silverleaf app</h1>
        <p>
          {people.length} people, pulled from Onboarding, Ops, Data & Tech, 1–5’s, and Marketing.
          Live department sites still keep their own databases until each one is cut over.
        </p>
      </header>
      {people.length === 0 ? (
        <p className={styles.empty}>No shared people yet. Load workplace data first.</p>
      ) : (
        <ul className={styles.visits}>
          {people.map((person) => (
            <li key={person.email} className={styles.visit}>
              <span className={styles.visitWho}>
                <i aria-hidden="true">
                  {person.fullName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase() || person.email.slice(0, 2).toUpperCase()}
                </i>
                <strong>{person.fullName}</strong>
                <em>{person.email}</em>
              </span>
              <span className={styles.visitTimes}>
                <strong>{person.jobTitle || "Staff"}</strong>
                <em>{person.campus || "—"}</em>
              </span>
              <span className={styles.visitDesks}>
                {person.apps.map((app) => (
                  <em key={app}>{APP_LABEL[app] ?? app}</em>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.back}>
        <Link href="/activity">Who entered</Link>
        {" · "}
        <Link href="/hub">Back to hub</Link>
      </p>
    </div>
  );
}
