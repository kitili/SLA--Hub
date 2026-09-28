import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET   /api/incident-alerts — admin + director read the escalation feed
 * POST  /api/incident-alerts — escalate an incident to command center
 * PATCH /api/incident-alerts — admin acknowledges an alert (RLS also
 *                               enforces this; director's session can't
 *                               update even if this check were bypassed)
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "director"]);
  if ("response" in auth) return auth.response;

  const limit = Number(new URL(request.url).searchParams.get("limit")) || 50;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("incident_alerts")
    .select(
      "id, incident_id, trip_id, severity, type, message, created_at, acknowledged_at, acknowledged_by",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 200));

  if (error) {
    const missing =
      /Could not find the table ['"]?public\.incident_alerts['"]?/i.test(
        error.message,
      ) || error.code === "PGRST205";
    return NextResponse.json(
      {
        error: error.message,
        ...(missing
          ? {
              hint: "Run supabase/APPLY_INCIDENT_ALERTS_01_enum.sql, then APPLY_INCIDENT_ALERTS.sql in the Supabase SQL Editor (two separate runs).",
              setup: "APPLY_INCIDENT_ALERTS.sql",
            }
          : {}),
      },
      { status: missing ? 503 : 400 },
    );
  }

  return NextResponse.json({ alerts: data ?? [] });
}

/**
 * Escalate an incident (or re-open an ack'd alert) onto the super-admin
 * command center feed at /ops/admin.
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    incidentId?: string;
    alertId?: string;
  };

  const admin = createServiceClient();

  // Re-open an existing alert for command center (clear acknowledgement).
  if (body.alertId?.trim()) {
    const { data, error } = await admin
      .from("incident_alerts")
      .update({
        acknowledged_at: null,
        acknowledged_by: null,
      })
      .eq("id", body.alertId.trim())
      .select(
        "id, incident_id, trip_id, severity, type, message, created_at, acknowledged_at",
      )
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Alert not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ alert: data, escalated: true });
  }

  if (!body.incidentId?.trim()) {
    return NextResponse.json(
      { error: "incidentId or alertId is required" },
      { status: 400 },
    );
  }

  const incidentId = body.incidentId.trim();
  const { data: incident, error: incidentError } = await admin
    .from("incidents")
    .select("id, trip_id, type, severity, notes")
    .eq("id", incidentId)
    .maybeSingle();

  if (incidentError || !incident) {
    return NextResponse.json(
      { error: incidentError?.message ?? "Incident not found" },
      { status: 404 },
    );
  }

  const { data: existing } = await admin
    .from("incident_alerts")
    .select("id, acknowledged_at")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await admin
      .from("incident_alerts")
      .update({
        acknowledged_at: null,
        acknowledged_by: null,
      })
      .eq("id", existing.id)
      .select(
        "id, incident_id, trip_id, severity, type, message, created_at, acknowledged_at",
      )
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not escalate" },
        { status: 400 },
      );
    }
    return NextResponse.json({ alert: data, escalated: true, reused: true });
  }

  const message =
    `Silverleaf OPS ALERT (${String(incident.severity).toUpperCase()}): ${incident.type} escalated to command center on trip ${incident.trip_id}. ${
      incident.notes?.slice(0, 160) ?? ""
    }`.trim();

  const { data: alert, error: insertError } = await admin
    .from("incident_alerts")
    .insert({
      incident_id: incident.id,
      trip_id: incident.trip_id,
      severity: incident.severity,
      type: incident.type,
      message,
    })
    .select(
      "id, incident_id, trip_id, severity, type, message, created_at, acknowledged_at",
    )
    .single();

  if (insertError || !alert) {
    return NextResponse.json(
      { error: insertError?.message ?? "Could not create escalation" },
      { status: 400 },
    );
  }

  return NextResponse.json({ alert, escalated: true, reused: false }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as { alertId?: string };
  if (!body.alertId?.trim()) {
    return NextResponse.json({ error: "alertId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_alerts")
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: auth.userId,
    })
    .eq("id", body.alertId.trim())
    .select("id, acknowledged_at, acknowledged_by")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Alert not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ alert: data });
}
