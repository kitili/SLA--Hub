/**
 * TeacherActivityPanel — "who uses the system, and how often".
 *
 * Pure presentational Server Component. It receives the already-computed
 * {@link TeacherActivity} roster and {@link ActivityTrendDay} series and renders
 * three blocks: highlight stat cards, a daily-volume bar chart, and the full
 * teacher roster table. No client JS — bars are CSS heights, dates are
 * formatted at render time.
 */
import { getTranslations } from "next-intl/server";

import type {
  ActivityTrendDay,
  TeacherActivity,
} from "@/lib/admin/insights";
import styles from "./TeacherActivityPanel.module.css";

/** Short, locale-stable date (matches the dashboard's other dates). */
function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Day-of-month label for a `YYYY-MM-DD` trend key. */
function dayLabel(key: string): string {
  return key.slice(8, 10);
}

export default async function TeacherActivityPanel({
  roster,
  trend,
}: {
  roster: TeacherActivity[];
  trend: ActivityTrendDay[];
}) {
  const t = await getTranslations("lpAdmin.dashboard.teacherActivity");

  const activeCount = roster.filter((r) => r.isActive).length;
  const dormantCount = roster.length - activeCount;
  const topTeacher = roster[0]?.totalActions ? roster[0] : null;
  const maxEvents = Math.max(1, ...trend.map((d) => d.events));
  const trendHasData = trend.some((d) => d.events > 0);

  return (
    <div className={styles.panel}>
      <div>
        <h2 className={styles.heading}>{t("heading")}</h2>
        <p className={styles.description}>{t("description")}</p>

        {/* Highlights */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{activeCount}</span>
            <span className={styles.statLabel}>{t("active")}</span>
            <span className={styles.statHint}>{t("activeHint")}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{dormantCount}</span>
            <span className={styles.statLabel}>{t("dormant")}</span>
            <span className={styles.statHint}>{t("dormantHint")}</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.statValueSmall}`}>
              {topTeacher ? topTeacher.fullName : "—"}
            </span>
            <span className={styles.statLabel}>{t("mostActive")}</span>
            <span className={styles.statHint}>
              {topTeacher
                ? t("actionsCount", { count: topTeacher.totalActions })
                : t("noActivityYet")}
            </span>
          </div>
        </div>
      </div>

      {/* Trend */}
      <section className={styles.card} aria-labelledby="ta-trend">
        <h2 id="ta-trend" className={styles.heading}>
          {t("trendHeading")}
        </h2>
        <p className={styles.description}>{t("trendDescription")}</p>
        {trendHasData ? (
          <div
            className={styles.chart}
            role="img"
            aria-label={t("trendAria", { days: trend.length })}
          >
            {trend.map((d) => (
              <div key={d.day} className={styles.barCol}>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.bar} ${
                      d.events === 0 ? styles.barEmpty : ""
                    }`}
                    style={{
                      height: `${Math.round((d.events / maxEvents) * 100)}%`,
                    }}
                    title={t("barTitle", {
                      date: shortDate(new Date(`${d.day}T00:00:00Z`)),
                      events: d.events,
                      teachers: d.activeTeachers,
                    })}
                  />
                </div>
                <span className={styles.barLabel}>{dayLabel(d.day)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>{t("trendEmpty")}</p>
        )}
      </section>

      {/* Roster */}
      <section className={styles.card} aria-labelledby="ta-roster">
        <h2 id="ta-roster" className={styles.heading}>
          {t("rosterHeading")}
        </h2>
        {roster.length === 0 ? (
          <p className={styles.empty}>{t("empty")}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("table.teacher")}</th>
                  <th scope="col">{t("table.campus")}</th>
                  <th scope="col" className={styles.num}>
                    {t("table.planViews")}
                  </th>
                  <th scope="col" className={styles.num}>
                    {t("table.feedback")}
                  </th>
                  <th scope="col" className={styles.num}>
                    {t("table.searches")}
                  </th>
                  <th scope="col" className={styles.num}>
                    {t("table.total")}
                  </th>
                  <th scope="col">{t("table.lastActive")}</th>
                  <th scope="col">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.staffId}>
                    <td>
                      <span className={styles.teacherCell}>
                        <span className={styles.teacherName}>{r.fullName}</span>
                        <span className={styles.teacherEmail}>{r.email}</span>
                      </span>
                    </td>
                    <td>{r.campus ?? "—"}</td>
                    <td className={styles.num}>{r.planViews}</td>
                    <td className={styles.num}>{r.feedbackGiven}</td>
                    <td className={styles.num}>{r.searches}</td>
                    <td className={styles.num}>{r.totalActions}</td>
                    <td>{r.lastActiveAt ? shortDate(r.lastActiveAt) : t("never")}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          r.isActive ? styles.badgeActive : styles.badgeDormant
                        }`}
                      >
                        {r.isActive ? t("status.active") : t("status.dormant")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
