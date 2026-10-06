import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { departments } from "@/lib/departments";
import { formatWhen } from "@/lib/format-when";
import { APP_LABEL, DEPARTMENT_APP } from "@/lib/workplace-lanes";
import { listWorkplacePeople } from "@/lib/workplace-people";
import { isDepartmentId } from "@/components/DepartmentFilter";
import styles from "@/components/ActivityLog.module.css";

export const metadata: Metadata = {
  title: "People",
};

export const dynamic = "force-dynamic";

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default async function WorkplacePeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/hub");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const dept = typeof params.dept === "string" && isDepartmentId(params.dept) ? params.dept : null;
  const app = dept ? DEPARTMENT_APP[dept] : undefined;
  const deskName = dept ? departments.find((department) => department.id === dept)?.name : null;
  const people = await listWorkplacePeople({ app, q, limit: 500 });

  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <header className={styles.header}>
        <p className={styles.kicker}>{deskName ?? "Staff directory"}</p>
        <h1>{deskName ? `People on ${deskName}` : "People"}</h1>
        <p>
          Who works on which desk. Search by name or email.
          {q ? ` Showing matches for “${q}”.` : ""} Time in and time out are on Who entered.
        </p>
      </header>

      <form className={`${styles.filters} ${styles.filtersCompact}`} method="get" action="/people">
        <label>
          Find someone
          <input type="search" name="q" defaultValue={q} placeholder="Name or email" autoComplete="off" />
        </label>
        <label>
          Desk
          <select name="dept" defaultValue={dept ?? ""}>
            <option value="">All desks</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Search</button>
      </form>

      <div className={`${styles.stats} ${styles.statsCompact}`}>
        <div>
          <strong>{people.length}</strong>
          <span>{deskName ? `on ${deskName}` : "in the directory"}</span>
        </div>
      </div>

      {people.length === 0 ? (
        <p className={styles.empty}>
          {q || dept ? "No one matches that search." : "No people loaded in the directory yet."}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Campus</th>
                <th>Desks</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.email}>
                  <td>
                    <span className={styles.visitWho}>
                      <i aria-hidden="true">{initials(person.fullName, person.email)}</i>
                      <strong>{person.fullName}</strong>
                      <em>{person.email}</em>
                    </span>
                  </td>
                  <td>{person.jobTitle || "Staff"}</td>
                  <td>{person.campus || "—"}</td>
                  <td>
                    <span className={styles.visitDesks}>
                      {person.apps.length === 0
                        ? "—"
                        : person.apps.map((used) => (
                            <em key={used}>{APP_LABEL[used] ?? used}</em>
                          ))}
                    </span>
                  </td>
                  <td>{formatWhen(person.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.back}>
        {user.isAdmin ? (
          <>
            <Link href="/progress">Progress</Link>
            {" · "}
          </>
        ) : null}
        <Link href="/systems">Desk status</Link>
        {" · "}
        <Link href="/activity">Who entered</Link>
        {" · "}
        <Link href="/hub">Back to hub</Link>
      </p>
    </div>
  );
}
