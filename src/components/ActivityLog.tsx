import Link from "next/link";
import { accessEventTitle, formatAccessWhen } from "@/lib/access-copy";
import {
  ACCESS_PAGE_SIZE,
  accessPersonHref,
  accessQueryHref,
  type AccessQuery,
} from "@/lib/access-query";
import { formatStayLength, type AccessPerson, type AccessSession } from "@/lib/access-summary";
import { departments } from "@/lib/departments";
import type { AccessPersonOption } from "@/lib/db/repositories/access";
import styles from "./ActivityLog.module.css";

export type ActivityRow = {
  id: string;
  staffId: string;
  name: string;
  email: string;
  action: string;
  part: string | null;
  path?: string | null;
  at: string;
};

export default function ActivityLog({
  events,
  people,
  sessions,
  personOptions,
  query,
  signInsToday,
  eventTotal,
  embedded = false,
  person = null,
}: {
  events: ActivityRow[];
  people: AccessPerson[];
  sessions: AccessSession[];
  personOptions: AccessPersonOption[];
  query: AccessQuery;
  signInsToday: number;
  eventTotal: number;
  embedded?: boolean;
  person?: AccessPerson | null;
}) {
  const pageCount = Math.max(1, Math.ceil(eventTotal / ACCESS_PAGE_SIZE));
  const uniqueDesks = new Set(sessions.flatMap((session) => session.desks)).size;

  return (
    <div className={embedded ? styles.embed : styles.page}>
      {embedded ? null : (
        <header className={styles.header}>
          <p className={styles.kicker}>{person ? "Staff record" : "HR accountability"}</p>
          <h1>{person ? person.name : "Who used the workplace"}</h1>
          <p>
            {person
              ? `${person.email} · time in, time out, and dashboards opened from the hub`
              : "Every sign-in, sign-out, and dashboard open is stored. Filter by person, desk, or dates so the list stays small."}
          </p>
        </header>
      )}

      <form
        className={styles.filters}
        method="get"
        action={person ? `/activity/${person.staffId}` : embedded ? undefined : "/activity"}
      >
        {person ? null : (
          <label>
            Person
            <select name="person" defaultValue={query.staffId}>
              <option value="">Everyone</option>
              {personOptions.map((option) => (
                <option key={option.staffId} value={option.staffId}>
                  {option.name || option.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Dashboard
          <select name="desk" defaultValue={query.departmentId}>
            <option value="">All desks</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        {person ? null : (
          <label>
            What
            <select name="what" defaultValue={query.action}>
              <option value="">All activity</option>
              <option value="signed_in">Time in</option>
              <option value="signed_out">Time out</option>
              <option value="opened_desk">Dashboard opened</option>
              <option value="opened_hub">Hub home</option>
            </select>
          </label>
        )}
        <label>
          From
          <input type="date" name="from" defaultValue={query.from} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={query.to} />
        </label>
        <button type="submit">Apply filters</button>
      </form>

      <div className={styles.stats}>
        <div>
          <strong>{person ? person.signIns : signInsToday}</strong>
          <span>{person ? "Sign-ins in this log" : "Sign-ins in 24 hours"}</span>
        </div>
        <div>
          <strong>{sessions.length}</strong>
          <span>Visits in this filter</span>
        </div>
        <div>
          <strong>{uniqueDesks}</strong>
          <span>Dashboards touched</span>
        </div>
        <div>
          <strong>{person ? people.length : personOptions.length}</strong>
          <span>People stored</span>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Time in and time out</h2>
          <p>One row per visit. Dashboards are the desks they opened from the hub during that visit.</p>
        </div>
        {sessions.length === 0 ? (
          <p className={styles.empty}>No visits in this filter. Widen the dates or clear a person/desk.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {person ? null : <th>Who</th>}
                  <th>Time in</th>
                  <th>Time out</th>
                  <th>Stay</th>
                  <th>Dashboards touched</th>
                  {person ? null : (
                    <th>
                      <span className={styles.srOnly}>Open record</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    {person ? null : (
                      <td>
                        <strong>{session.name}</strong>
                        <span>{session.email}</span>
                      </td>
                    )}
                    <td>{formatAccessWhen(session.inAt)}</td>
                    <td>{session.outAt ? formatAccessWhen(session.outAt) : "Still in"}</td>
                    <td>{session.outAt ? formatStayLength(session.inAt, session.outAt) : "Open"}</td>
                    <td>{session.desks.length ? session.desks.join(", ") : "Hub only"}</td>
                    {person ? null : (
                      <td>
                        <Link href={accessPersonHref(session.staffId, query)}>View times</Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Stored activity</h2>
          <p>
            {eventTotal} row{eventTotal === 1 ? "" : "s"} in this filter. Showing page {query.page} of {pageCount}.
          </p>
        </div>
        {events.length === 0 ? (
          <p className={styles.empty}>Nothing stored for these filters.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  {person ? null : <th>Who</th>}
                  <th>What they did</th>
                  <th>Dashboard</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatAccessWhen(event.at)}</td>
                    {person ? null : (
                      <td>
                        <strong>{event.name || "Staff"}</strong>
                        <span>{event.email}</span>
                      </td>
                    )}
                    <td>{accessEventTitle(event.action, event.part)}</td>
                    <td>
                      {event.part ??
                        (event.action === "opened_hub"
                          ? "Hub home"
                          : event.action === "signed_in" || event.action === "signed_out"
                            ? "Sign-in"
                            : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pageCount > 1 ? (
          <nav className={styles.pager} aria-label="Activity pages">
            {query.page > 1 ? (
              <Link href={accessQueryHref(query, { page: query.page - 1 }, person ? `/activity/${person.staffId}` : "/activity")}>
                Previous
              </Link>
            ) : (
              <span>Previous</span>
            )}
            <em>
              {query.page} / {pageCount}
            </em>
            {query.page < pageCount ? (
              <Link href={accessQueryHref(query, { page: query.page + 1 }, person ? `/activity/${person.staffId}` : "/activity")}>
                Next
              </Link>
            ) : (
              <span>Next</span>
            )}
          </nav>
        ) : null}
      </section>

      {embedded ? null : (
        <p className={styles.back}>
          <Link href={person ? accessQueryHref({ ...query, staffId: "", page: 1 }) : "/hub"}>
            {person ? "All people" : "Back to hub"}
          </Link>
        </p>
      )}
    </div>
  );
}
