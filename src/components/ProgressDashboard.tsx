import Link from "next/link";
import DepartmentFilter, { isDepartmentId } from "@/components/DepartmentFilter";
import { ArrowIcon, DepartmentIcon } from "@/components/icons";
import type { WorkplaceKpis } from "@/lib/workplace-kpis";
import hub from "./hub.module.css";
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
    <div className={hub.page}>
      <section className={hub.hero}>
        <div className={hub.heroCopy}>
          <p className={hub.heroKicker}>All desks · Ed Admin</p>
          <h1 className={hub.heroTitle}>{focus ? focus.name : "Workplace progress"}</h1>
          <p className={hub.heroBody}>
            {focus
              ? focus.headline
              : "One intake of every live desk, then a deep dive when you pick a department."}
          </p>
          <div className={hub.heroMeta}>
            <span>
              {kpis.liveSystems}/{kpis.totalSystems} live
            </span>
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
            <span className={hub.cardIcon} data-ok={focus.liveOk}>
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
          </p>
        </section>
      ) : (
        <div className={hub.grid}>
          {rows.map((row) => (
            <article key={row.id} className={hub.card} data-accent="gold" data-desk={row.id}>
              <Link href={`/progress?dept=${row.id}`} className={hub.cardMain}>
                <span className={hub.cardIcon}>
                  <DepartmentIcon id={row.id} />
                </span>
                <p className={hub.cardKicker}>{row.lane}</p>
                <h2>{row.name}</h2>
                <p>{row.headline}</p>
                <ul className={hub.cardDesks}>
                  {row.metrics.slice(0, 3).map((metric) => (
                    <li key={metric.label}>{metric.value}</li>
                  ))}
                </ul>
                <span className={hub.cardOpen}>
                  Deep dive <ArrowIcon />
                </span>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
