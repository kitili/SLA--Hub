import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkplaceMap } from "@/lib/workplace-map";
import { DepartmentIcon } from "@/components/icons";
import type { DepartmentId } from "@/lib/departments";
import DeskOpen from "@/components/DeskOpen";
import styles from "@/components/WorkplaceMap.module.css";
import { getSystemBridge } from "@/lib/system-bridge";

export const metadata: Metadata = {
  title: "Desk status",
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function WorkplaceSystemsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [map, bridge] = await Promise.all([getWorkplaceMap(), getSystemBridge()]);
  const systems = map.filter((system) => system.id !== "hub");
  const handoffs = bridge.filter((row) => row.available);
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
                  <DeskOpen id={system.id} liveUrl={system.liveUrl} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className={styles.bridge}>
        <p className={styles.kicker}>Already on file</p>
        <h2>What the desks can read from each other</h2>
        <p>These are counts and statuses from records that already exist. Names and phone numbers stay in the desk that collected them.</p>
        {handoffs.length === 0 ? (
          <p>None of the shared desks answered from this database yet.</p>
        ) : (
          <div className={styles.links}>
            {handoffs.map((row) => (
              <article key={row.id} className={styles.link}>
                <strong>{row.from} → {row.title}</strong>
                <p>{row.summary}</p>
                <ul>
                  {row.facts.map((fact) => (
                    <li key={fact.label}>{fact.label}: {fact.value}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
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
