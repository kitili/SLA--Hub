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
      <header className={styles.header}>
        <p className={styles.kicker}>Super admin · all systems</p>
        <h1>{focus ? `${focus.name} deep dive` : "Workplace progress"}</h1>
        <p>
          High intake first: how the academy is moving across desks. Filter a
          department for the numbers behind it. Live sites keep their own logins.
        </p>
      </header>

      <div className={styles.intake}>
        <article>
          <strong>{kpis.overallScore}%</strong>
          <span>Overall health</span>
        </article>
        <article>
          <strong>
            {kpis.liveSystems}/{kpis.totalSystems}
          </strong>
          <span>Live desks answering</span>
        </article>
        <article>
          <strong>{kpis.people}</strong>
          <span>People across apps</span>
        </article>
        <article>
          <strong>{kpis.signIns24h}</strong>
          <span>Hub sign-ins, 24h</span>
        </article>
      </div>

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
            <em className={styles.score}>{focus.score}%</em>
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
            <article>
              <strong>{focus.liveOk ? "Live" : "Quiet"}</strong>
              <span>Hosted site</span>
              <em>{focus.liveOk ? "Answered this check" : "No answer on the last check"}</em>
            </article>
          </div>
          <p className={styles.note}>{focus.note}</p>
          <p className={styles.actions}>
            <a href={focus.liveUrl} target="_blank" rel="noreferrer">
              Open live {focus.name}
            </a>
            <Link href="/people">Everyone</Link>
            <Link href="/systems">Systems</Link>
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
                  {row.metrics.slice(0, 3).map((metric) => (
                    <li key={metric.label}>
                      <b>{metric.value}</b>
                      <span>{metric.label}</span>
                    </li>
                  ))}
                </ul>
                <footer>
                  <em data-ok={row.liveOk}>{row.liveOk ? "Live" : "No answer"}</em>
                  <strong>{row.score}%</strong>
                </footer>
              </Link>
            </article>
          ))}
        </section>
      )}

      <p className={styles.stamp}>
        Snapshot {fmtWhen(kpis.generatedAt)}. Ops numbers are read from the Ops
        schema without writing to it.
      </p>
    </div>
  );
}
