import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listWorkplacePeople } from "@/lib/workplace-people";
import { APP_LABEL, DEPARTMENT_APP } from "@/lib/workplace-lanes";
import DepartmentFilter, { isDepartmentId } from "@/components/DepartmentFilter";
import styles from "@/components/ActivityLog.module.css";

export const metadata: Metadata = {
  title: "Everyone in the workplace",
};

export const dynamic = "force-dynamic";

export default async function WorkplacePeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/hub");
  const params = await searchParams;
  const dept = typeof params.dept === "string" && isDepartmentId(params.dept) ? params.dept : null;
  const app = dept ? DEPARTMENT_APP[dept] : undefined;
  const people = await listWorkplacePeople({ app, limit: 500 });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>{dept ? APP_LABEL[app ?? ""] ?? "One desk" : "All systems"}</p>
        <h1>{dept ? `Everyone in ${APP_LABEL[app ?? ""] ?? "this desk"}` : "Everyone who has used a Silverleaf app"}</h1>
        <p>
          {people.length} people
          {dept ? ` in ${APP_LABEL[app ?? ""]}.` : ", pulled from every loaded workplace app."}{" "}
          Live department sites still keep their own databases until each one is cut over.
        </p>
      </header>
      <DepartmentFilter base="/people" current={dept} />
      {people.length === 0 ? (
        <p className={styles.empty}>No shared people yet{dept ? " in this department" : ""}. Load workplace data first.</p>
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
                {person.apps.map((used) => (
                  <em key={used}>{APP_LABEL[used] ?? used}</em>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.back}>
        <Link href="/progress">Progress</Link>
        {" · "}
        <Link href="/activity">Who entered</Link>
        {" · "}
        <Link href="/hub">Back to hub</Link>
      </p>
    </div>
  );
}
