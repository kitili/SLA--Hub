import Link from "next/link";
import { accessActionLabel, formatAccessWhen } from "@/lib/access-copy";
import styles from "./ActivityLog.module.css";

export type ActivityRow = {
  id: string;
  name: string;
  email: string;
  action: string;
  part: string | null;
  path?: string | null;
  at: string;
};

export default function ActivityLog({
  events,
  signInsToday,
  embedded = false,
}: {
  events: ActivityRow[];
  signInsToday: number;
  embedded?: boolean;
}) {
  const people = new Set(events.filter((event) => event.action === "signed_in" || event.action === "opened_desk").map((event) => event.email)).size;

  return (
    <div className={embedded ? styles.embed : styles.page}>
      {embedded ? null : (
        <header className={styles.header}>
          <p className={styles.kicker}>Workplace activity</p>
          <h1>Who entered, and where</h1>
          <p>Every sign-in and desk open is recorded against the staff member’s work email.</p>
        </header>
      )}

      <div className={styles.stats}>
        <div>
          <strong>{signInsToday}</strong>
          <span>Sign-ins in 24 hours</span>
        </div>
        <div>
          <strong>{people}</strong>
          <span>People in this list</span>
        </div>
        <div>
          <strong>{events.length}</strong>
          <span>Recent events</span>
        </div>
      </div>

      {events.length === 0 ? (
        <p className={styles.empty}>No one has entered yet. The next sign-in or desk click will show here.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What they did</th>
                <th>Part of the system</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{formatAccessWhen(event.at)}</td>
                  <td>
                    <strong>{event.name || "Staff"}</strong>
                    <span>{event.email}</span>
                  </td>
                  <td>{accessActionLabel(event.action)}</td>
                  <td>{event.part ?? (event.action === "opened_hub" ? "Hub home" : event.action === "signed_in" ? "Sign-in" : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {embedded ? null : (
        <p className={styles.back}>
          <Link href="/hub">Back to hub</Link>
        </p>
      )}
    </div>
  );
}
