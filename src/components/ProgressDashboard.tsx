import Link from "next/link";
import { ArrowIcon, DepartmentIcon } from "@/components/icons";
import { formatWhen } from "@/lib/format-when";
import type { WorkplaceKpis } from "@/lib/workplace-kpis";
import hub from "./hub.module.css";
import styles from "./ProgressDashboard.module.css";

export default function ProgressDashboard({
  kpis,
  dept,
}: {
  kpis: WorkplaceKpis;
  dept?: string | null;
}) {
  const focus = kpis.departments.find((row) => row.id === dept) ?? null;

  return (
    <div className={hub.page}>
      <section className={hub.hero}>
        <div className={hub.heroCopy}>
          <p className={hub.heroKicker}>{focus ? focus.name : "How work is going"}</p>
          <h1 className={hub.heroTitle}>{focus ? "The numbers" : "Progress"}</h1>
          <p className={hub.heroBody}>
            {focus
              ? focus.headline
              : "One scoreboard for every desk. Open Numbers on a row when you want the counts."}
          </p>
          <div className={hub.heroMeta}>
            <span>
              {kpis.liveSystems}/{kpis.totalSystems} desks live
            </span>
            <span>{kpis.people} people</span>
            <span>{kpis.signIns24h} hub sign-ins today</span>
            {focus ? (
              <Link href="/progress" className={hub.heroLink}>
                All desks
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {focus ? (
        <section className={styles.deep}>
          <div className={styles.deepHead}>
            <span className={hub.cardIcon} data-ok={focus.liveOk}>
              <DepartmentIcon id={focus.id} />
            </span>
            <div>
              <h2>{focus.name}</h2>
              <p>{focus.headline}</p>
            </div>
            <em className={styles.live} data-ok={focus.liveOk}>
              {focus.liveOk ? "Live" : "Down"}
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
              <span>People on this desk</span>
              <em>{formatWhen(focus.lastSeen, "No activity yet")}</em>
            </article>
          </div>
          <p className={styles.note}>{focus.note}</p>
          <p className={styles.actions}>
            <a href={focus.liveUrl} target="_blank" rel="noreferrer">
              Open live {focus.name}
            </a>
            <Link href={`/people?dept=${focus.id}`}>People on this desk</Link>
            <Link href="/systems">Desk status</Link>
          </p>
        </section>
      ) : (
        <div className={styles.board}>
          <table>
            <thead>
              <tr>
                <th>Desk</th>
                <th>Site</th>
                <th>What’s happening</th>
                <th>People</th>
                <th>
                  <span className={styles.srOnly}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {kpis.departments.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={styles.desk}>
                      <span className={styles.deskIcon}>
                        <DepartmentIcon id={row.id} />
                      </span>
                      <strong>{row.name}</strong>
                    </span>
                  </td>
                  <td>
                    <em className={styles.live} data-ok={row.liveOk}>
                      {row.liveOk ? "Live" : "Down"}
                    </em>
                  </td>
                  <td>{row.headline}</td>
                  <td>{row.people}</td>
                  <td className={styles.rowActions}>
                    <Link href={`/progress?dept=${row.id}`}>
                      Numbers <ArrowIcon />
                    </Link>
                    <a href={row.liveUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
