import Link from "next/link";
import DepartmentFilter, { isDepartmentId } from "@/components/DepartmentFilter";
import { ArrowIcon, DepartmentIcon } from "@/components/icons";
import type { DepartmentId } from "@/lib/departments";
import type { WorkplaceKpis } from "@/lib/workplace-kpi-types";
import hub from "./hub.module.css";
import styles from "./ProgressDashboard.module.css";

export default function ProgressDashboard({
  kpis,
  dept,
}: {
  kpis: WorkplaceKpis;
  dept?: string | null;
}) {
  const selected = isDepartmentId(dept) ? dept : null;
  const rows = selected ? kpis.departments.filter((row) => row.id === selected) : kpis.departments;
  const focus = selected ? rows[0] : null;

  return (
    <div className={hub.page}>
      <section className={hub.hero}>
        <div className={hub.heroCopy}>
          <p className={hub.heroKicker}>{focus ? focus.name : "Every dashboard"}</p>
          <h1 className={hub.heroTitle}>{focus ? "Department numbers" : "Progress"}</h1>
          <p className={hub.heroBody}>
            {focus
              ? focus.headline
              : "KPIs from every desk. Filter by department when you want one view."}
          </p>
          <div className={hub.heroMeta}>
            <span>{kpis.totalSystems} desks</span>
            <span>{kpis.people} people</span>
            <span>{kpis.signIns24h} hub sign-ins today</span>
            {focus ? (
              <Link href="/progress" className={hub.heroLink}>
                All departments
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <DepartmentFilter base="/progress" current={selected} />

      {focus ? (
        <section className={styles.deep}>
          <div className={styles.deepHead}>
            <span className={hub.cardIcon}>
              <DepartmentIcon id={focus.id as DepartmentId} />
            </span>
            <div>
              <h2>{focus.name}</h2>
              <p>{focus.headline}</p>
            </div>
          </div>
          <div className={styles.metrics}>
            {focus.metrics.map((metric) => (
              <article key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
                {metric.hint ? <em>{metric.hint}</em> : null}
              </article>
            ))}
            <article>
              <strong>{focus.people}</strong>
              <span>People on this desk</span>
            </article>
          </div>
          <p className={styles.note}>{focus.note}</p>
          <p className={styles.actions}>
            <a href={focus.liveUrl} target="_blank" rel="noreferrer">
              Open live {focus.name}
            </a>
            <Link href={`/people?dept=${focus.id}`}>People on this desk</Link>
          </p>
        </section>
      ) : (
        <div className={styles.kpiGrid}>
          {rows.map((row) => (
            <article key={row.id} className={styles.kpiCard}>
              <header>
                <span className={styles.deskIcon}>
                  <DepartmentIcon id={row.id as DepartmentId} />
                </span>
                <div>
                  <h2>{row.name}</h2>
                  <p>{row.headline}</p>
                </div>
              </header>
              <ul>
                {row.metrics.slice(0, 4).map((metric) => (
                  <li key={metric.label}>
                    <span>{metric.label}</span>
                    <b>{metric.value}</b>
                  </li>
                ))}
              </ul>
              <footer>
                <Link href={`/progress?dept=${row.id}`}>
                  More numbers <ArrowIcon />
                </Link>
                <a href={row.liveUrl} target="_blank" rel="noreferrer">
                  Open desk
                </a>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
