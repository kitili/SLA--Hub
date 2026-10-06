import Link from "next/link";
import DepartmentFilter, { isDepartmentId } from "@/components/DepartmentFilter";
import { DepartmentIcon } from "@/components/icons";
import type { WorkplaceKpis } from "@/lib/workplace-kpis";
import styles from "./ProgressDashboard.module.css";

function fmtWhen(iso: string | null) {
  if (!iso) return "No activity yet";
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

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
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Krupa Patel · Nelly Zablon</p>
        <h1>{focus ? focus.name : "Workplace progress"}</h1>
        <p>
          {focus
            ? focus.headline
            : "One view of every desk. Filter a department to go deeper. Sign-in is Ed Admin."}
        </p>
        <div className={styles.heroMeta}>
          <span>
            {kpis.liveSystems}/{kpis.totalSystems} live
          </span>
          <span>{kpis.people} people</span>
          <span>{kpis.signIns24h} hub sign-ins today</span>
        </div>
      </section>

      <DepartmentFilter base="/progress" current={selected} />

      {focus ? (
        <section className={styles.deep}>
          <div className={styles.deepHead}>
            <span className={styles.icon} data-ok={focus.liveOk}>
              <DepartmentIcon id={focus.id} />
            </span>
            <div>
              <p className={styles.lane}>{focus.lane}</p>
              <h2>{focus.name}</h2>
              <p>{focus.headline}</p>
            </div>
            <em className={styles.live} data-ok={focus.liveOk}>
              {focus.liveOk ? "Live" : "No answer"}
            </em>
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
              <span>People in this app</span>
              <em>{fmtWhen(focus.lastSeen)}</em>
            </article>
          </div>
          <p className={styles.note}>{focus.note}</p>
          <p className={styles.actions}>
            <a href={focus.liveUrl} target="_blank" rel="noreferrer">
              Open live {focus.name}
            </a>
            <Link href="/people">Everyone</Link>
            <Link href="/systems">Systems</Link>
            <Link href="/progress">All departments</Link>
          </p>
        </section>
      ) : (
        <section className={styles.grid}>
          {rows.map((row) => (
            <article key={row.id} className={styles.card} data-ok={row.liveOk}>
              <Link href={`/progress?dept=${row.id}`} className={styles.cardMain}>
                <span className={styles.icon}>
                  <DepartmentIcon id={row.id} />
                </span>
                <p className={styles.lane}>{row.lane}</p>
                <h2>{row.name}</h2>
                <p>{row.headline}</p>
                <ul>
                  {row.metrics.slice(0, 2).map((metric) => (
                    <li key={metric.label}>
                      <b>{metric.value}</b>
                      <span>{metric.label}</span>
                    </li>
                  ))}
                </ul>
                <footer>
                  <em data-ok={row.liveOk}>{row.liveOk ? "Live" : "No answer"}</em>
                  <span>Open</span>
                </footer>
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
