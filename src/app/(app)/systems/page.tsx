import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkplaceMap } from "@/lib/workplace-map";
import { DepartmentIcon } from "@/components/icons";
import type { DepartmentId } from "@/lib/departments";
import styles from "@/components/WorkplaceMap.module.css";

export const metadata: Metadata = {
  title: "Desk status",
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function WorkplaceSystemsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const systems = (await getWorkplaceMap()).filter((system) => system.id !== "hub");
  const live = systems.filter((system) => system.smoke.ok).length;
  const down = systems.length - live;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Live sites</p>
        <h1>Desk status</h1>
        <p>
          Which department sites are answering right now.
          {user.isAdmin ? " Work numbers are on Progress. The staff list is on People." : ""}
        </p>
      </header>
      <div className={styles.stats}>
        <div>
          <strong>{live}</strong>
          <span>live</span>
        </div>
        <div>
          <strong>{down}</strong>
          <span>not answering</span>
        </div>
        <div>
          <strong>{systems.length}</strong>
          <span>desks checked</span>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Desk</th>
              <th>Status</th>
              <th>Response</th>
              <th>
                <span className={styles.srOnly}>Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {systems.map((system) => (
              <tr key={system.id}>
                <td>
                  <span className={styles.desk}>
                    <span className={styles.deskIcon}>
                      <DepartmentIcon id={system.id as DepartmentId} />
                    </span>
                    <strong>{system.name}</strong>
                  </span>
                </td>
                <td>
                  <em className={styles.smoke} data-ok={system.smoke.ok}>
                    {system.smoke.ok ? "Live" : "Down"}
                  </em>
                </td>
                <td>
                  {system.smoke.ok
                    ? `${system.smoke.ms} ms`
                    : system.smoke.status
                      ? `HTTP ${system.smoke.status}`
                      : "No answer"}
                </td>
                <td>
                  <a href={system.liveUrl} target="_blank" rel="noreferrer">
                    Open live
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.back}>
        {user.isAdmin ? (
          <>
            <Link href="/progress">Progress</Link>
            {" · "}
          </>
        ) : null}
        {user.isAdmin ? (
          <>
            <Link href="/people">People</Link>
            {" · "}
          </>
        ) : null}
        <Link href="/hub">Back to hub</Link>
      </p>
    </div>
  );
}
