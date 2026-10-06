import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkplaceMap } from "@/lib/workplace-map";
import DepartmentFilter, { isDepartmentId } from "@/components/DepartmentFilter";
import styles from "@/components/WorkplaceMap.module.css";

export const metadata: Metadata = {
  title: "Workplace systems",
};

export const dynamic = "force-dynamic";

export default async function WorkplaceSystemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const dept = typeof params.dept === "string" && isDepartmentId(params.dept) ? params.dept : null;
  const systems = await getWorkplaceMap();
  const visible = dept ? systems.filter((system) => system.id === dept) : systems;
  const live = visible.filter((system) => system.smoke.ok).length;
  const tables = visible.reduce((sum, system) => sum + system.tableCount, 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>One repository · one Supabase</p>
        <h1>{dept ? `${visible[0]?.name ?? "This desk"} lane` : "Every system has its own lane"}</h1>
        <p>
          Code is grouped under desks/ and src/. Data is grouped by schema. Ops
          live tables stay in public. Nothing else is allowed there.
        </p>
      </header>
      <DepartmentFilter base="/systems" current={dept} />
      <div className={styles.stats}>
        <div>
          <strong>{visible.length}</strong>
          <span>{dept ? "system in this filter" : "systems in this repo"}</span>
        </div>
        <div>
          <strong>{live}</strong>
          <span>live sites answering</span>
        </div>
        <div>
          <strong>{tables}</strong>
          <span>tables in labeled schemas</span>
        </div>
        <div>
          <strong>public</strong>
          <span>Ops only</span>
        </div>
      </div>
      <div className={styles.grid}>
        {visible.map((system) => (
          <article key={system.id} className={styles.cell} data-lane={system.lane}>
            <p className={styles.lane}>{system.lane}</p>
            <h2>{system.name}</h2>
            <div className={styles.meta}>
              <div>
                <b>Supabase</b>
                <span>{system.schemaName}</span>
              </div>
              <div>
                <b>Code</b>
                <span>{system.repoFolder}</span>
              </div>
              <div>
                <b>Tables</b>
                <span>{system.tableCount}</span>
              </div>
            </div>
            {system.tables.length > 0 ? (
              <p className={styles.tables}>
                {system.tables.slice(0, 8).join(" · ")}
                {system.tables.length > 8 ? ` · +${system.tables.length - 8} more` : ""}
              </p>
            ) : (
              <p className={styles.tables}>Schema reserved. Live site still uses its own database.</p>
            )}
            <p className={styles.notes}>{system.schemaComment || system.notes}</p>
            <div className={styles.footer}>
              <em className={styles.smoke} data-ok={system.smoke.ok}>
                {system.smoke.ok ? `Live ${system.smoke.status}` : "No answer"}
              </em>
              <a href={system.liveUrl} target="_blank" rel="noreferrer">
                Open live
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className={styles.back}>
        <Link href="/progress">Progress</Link>
        {" · "}
        <Link href="/people">Everyone</Link>
        {" · "}
        <Link href="/hub">Back to hub</Link>
      </p>
    </div>
  );
}
