"use client";

import type { DepartmentKpi, HourBeat, PulsePoint } from "@/lib/workplace-kpi-types";
import styles from "./ProgressDashboard.module.css";

function Spark({ values }: { values: number[] }) {
  const width = 120;
  const height = 28;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className={styles.spark} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

function PulseChart({ pulse }: { pulse: PulsePoint[] }) {
  const width = 640;
  const height = 168;
  const pad = { top: 12, right: 8, bottom: 28, left: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...pulse.flatMap((point) => [point.hub, point.work]), 1);

  function coords(values: number[]) {
    return values.map((value, index) => {
      const x = pad.left + (pulse.length <= 1 ? innerW / 2 : (index / (pulse.length - 1)) * innerW);
      const y = pad.top + innerH - (value / max) * innerH;
      return { x, y };
    });
  }

  const hub = coords(pulse.map((point) => point.hub));
  const work = coords(pulse.map((point) => point.work));
  const hubLine = hub.map((point) => `${point.x},${point.y}`).join(" ");
  const workLine = work.map((point) => `${point.x},${point.y}`).join(" ");
  const hubArea = `${pad.left},${pad.top + innerH} ${hubLine} ${pad.left + innerW},${pad.top + innerH}`;

  return (
    <svg className={styles.pulseSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Activity over the last 14 days">
      <polygon className={styles.pulseFill} points={hubArea} />
      <polyline className={styles.pulseHub} fill="none" strokeWidth="2.5" points={hubLine} />
      <polyline className={styles.pulseWork} fill="none" strokeWidth="2.5" points={workLine} />
      {pulse.map((point, index) =>
        index % 2 === 0 || index === pulse.length - 1 ? (
          <text key={point.day} x={hub[index]?.x ?? 0} y={height - 8} textAnchor="middle">
            {point.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export default function ProgressMusic({
  pulse,
  hours,
  departments,
}: {
  pulse: PulsePoint[];
  hours: HourBeat[];
  departments: DepartmentKpi[];
}) {
  const loudest = hours.reduce(
    (best, beat) => (beat.count > best.count ? beat : best),
    hours[0] ?? { hour: 0, label: "—", count: 0 },
  );
  const hourMax = Math.max(...hours.map((beat) => beat.count), 1);
  const peopleMax = Math.max(...departments.map((row) => row.people), 1);
  const hubTotal = pulse.reduce((sum, point) => sum + point.hub, 0);
  const workTotal = pulse.reduce((sum, point) => sum + point.work, 0);

  return (
    <div className={styles.stage}>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <p>Last 14 days</p>
          <h2>How work has been moving</h2>
          <span>
            Gold is hub traffic. Blue is trips, visits, 1–5s, and onboarding starts ({hubTotal} hub · {workTotal} work).
          </span>
        </div>
        <PulseChart pulse={pulse} />
      </section>

      <section className={`${styles.panel} ${styles.musicPanel}`}>
        <div className={styles.panelHead}>
          <p>The day’s music</p>
          <h2>When the workplace is loud</h2>
          <span>
            {loudest.count > 0
              ? `Peak around ${loudest.label} East Africa time.`
              : "Hub hours will fill this as people sign in."}
          </span>
        </div>
        <div className={styles.equalizer} aria-label="Hub activity by hour">
          {hours.map((beat, index) => (
            <div key={beat.hour} className={styles.beatCol}>
              <span
                className={styles.beat}
                style={{
                  height: `${Math.max(6, (beat.count / hourMax) * 100)}%`,
                  animationDelay: `${index * 70}ms`,
                }}
                title={`${beat.label}: ${beat.count}`}
              />
              {beat.hour % 3 === 0 ? <em>{beat.label.replace(" ", "")}</em> : <em />}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <p>People</p>
          <h2>Who sits where</h2>
        </div>
        <ul className={styles.bars}>
          {departments
            .slice()
            .sort((a, b) => b.people - a.people)
            .map((row) => (
              <li key={row.id}>
                <span>{row.name}</span>
                <div className={styles.barTrack}>
                  <i style={{ width: `${Math.max(row.people ? 8 : 0, (row.people / peopleMax) * 100)}%` }} />
                </div>
                <b>{row.people}</b>
                {row.spark ? <Spark values={row.spark} /> : null}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
