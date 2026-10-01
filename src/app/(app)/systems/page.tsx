import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkplaceMap } from "@/lib/workplace-map";
import styles from "@/components/WorkplaceMap.module.css";

export const metadata: Metadata = {
  title: "Workplace systems",
};

export const dynamic = "force-dynamic";

export default async function WorkplaceSystemsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const systems = await getWorkplaceMap();
  const live = systems.filter((system) => system.smoke.ok).length;
  const tables = systems.reduce((sum, system) => sum + system.tableCount, 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>One repository · one Supabase</p>
        <h1>Every system has its own lane</h1>
        <p>
          Code is grouped under desks/ and src/. Data is grouped by schema. Ops
          live tables stay in public. Nothing else is allowed there.
        </p>
        <div className={styles.lanes}>
          {["CODE", "OPS", "ONBOARDING", "MARKETING", "DATA & TECH", "TALENT ACADEMY", "UNIFORMS", "VISITORS", "WORKBOARD", "LESSON PLANS", "MEL"].map((lane) => (
            <span key={lane}>{lane}</span>
          ))}
        </div>
      </header>
      <div className={styles.stats}>
        <div>
          <strong>{systems.length}</strong>
          <span>systems in this repo</span>
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
        {systems.map((system) => (
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
        <Link href="/people">Everyone</Link>
        {" · "}
        <Link href="/hub">Back to hub</Link>
      </p>
    </div>
  );
}
