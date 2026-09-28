import { listMessageLogs } from "@/lib/messaging/send";
import { getSchoolToday } from "@/lib/date/schoolDate";

const STATUS_STYLES: Record<string, string> = {
  sent: "text-success",
  failed: "text-danger",
  skipped: "text-ink-muted",
  queued: "text-ink-muted",
};

function startOfSchoolDayIso(): string {
  return new Date(`${getSchoolToday()}T00:00:00+03:00`).toISOString();
}

export default async function MessagesPage() {
  const since = startOfSchoolDayIso();
  const logs = await listMessageLogs({ since, limit: 200 });

  const sent = logs.filter((l) => l.status === "sent").length;
  const failed = logs.filter((l) => l.status === "failed").length;
  const skipped = logs.filter((l) => l.status === "skipped").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
          Admin · Silverleaf transport
        </p>
        <h1 className="mt-1 text-2xl font-bold text-electric-blue">
          Messages sent today
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Parent SMS/WhatsApp notifications triggered by boarding scans today.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
          <p className="text-xs text-ink-muted">Sent</p>
          <p className="mt-2 font-display text-2xl font-bold text-success">
            {sent}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
          <p className="text-xs text-ink-muted">Failed</p>
          <p className="mt-2 font-display text-2xl font-bold text-danger">
            {failed}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
          <p className="text-xs text-ink-muted">Skipped</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink-muted">
            {skipped}
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-card-border bg-light-blue-30 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Parent phone</th>
              <th className="px-4 py-3 font-semibold">Channel</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-ink-muted"
                >
                  No messages sent yet today.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(log.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Africa/Dar_es_Salaam",
                    })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">
                    {log.parent_phone}
                  </td>
                  <td className="px-4 py-3 uppercase text-ink-muted">
                    {log.channel}
                  </td>
                  <td
                    className={`px-4 py-3 font-semibold ${
                      STATUS_STYLES[log.status] ?? "text-ink"
                    }`}
                  >
                    {log.status}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {log.error_message ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
