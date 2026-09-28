import { createServiceClient } from "@/lib/supabase/admin";
import { sendAndLogMessage } from "@/lib/messaging/send";
import type { IncidentSeverity, IncidentType } from "@/types/database";

export type IncidentAlertResult = {
  alert_id: string | null;
  recipients_notified: number;
  recipients_skipped_no_phone: number;
};

/**
 * Called when a matron reports a high-severity (or accident/breakdown)
 * incident. Writes a dashboard-queryable incident_alerts row (for the
 * admin/director alerts feed) and texts every admin + director with a
 * phone on file, via the same audited SMS pipeline parent notifications
 * use. Uses the service-role client because the reporting matron's own
 * session has no RLS access to other staff's profiles/phone numbers, and
 * incident_alerts intentionally has no insert policy for regular roles.
 */
export async function notifyIncidentAlert(input: {
  incidentId: string;
  tripId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  notes?: string | null;
}): Promise<IncidentAlertResult> {
  const admin = createServiceClient();

  const message = `Silverleaf OPS ALERT (${input.severity.toUpperCase()}): ${input.type} reported on trip ${input.tripId}. ${
    input.notes?.slice(0, 160) ?? ""
  }`.trim();

  const { data: alert, error: alertError } = await admin
    .from("incident_alerts")
    .insert({
      incident_id: input.incidentId,
      trip_id: input.tripId,
      severity: input.severity,
      type: input.type,
      message,
    })
    .select("id")
    .single();

  if (alertError) {
    console.error(
      "[incident-alert] failed to write incident_alerts row:",
      alertError.message,
    );
  }

  const { data: recipients, error: profilesError } = await admin
    .from("profiles")
    .select("id, phone")
    .in("role", ["admin", "director"])
    .not("phone", "is", null);

  if (profilesError || !recipients) {
    console.error(
      "[incident-alert] failed to load admin/director recipients:",
      profilesError?.message,
    );
    return {
      alert_id: alert?.id ?? null,
      recipients_notified: 0,
      recipients_skipped_no_phone: 0,
    };
  }

  let notified = 0;
  let skipped = 0;
  for (const recipient of recipients) {
    const phone = recipient.phone?.trim();
    if (!phone) {
      skipped++;
      continue;
    }
    try {
      const { log } = await sendAndLogMessage({
        to: phone,
        body: message,
        templateKey: "incident_alert",
      });
      if (log.status === "sent") notified++;
    } catch (err) {
      console.error(
        `[incident-alert] failed to notify recipient ${recipient.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    alert_id: alert?.id ?? null,
    recipients_notified: notified,
    recipients_skipped_no_phone: skipped,
  };
}
