import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createClient } from "@/lib/supabase/server";
import { createIncident } from "@/lib/db/queries";
import { notifyIncidentAlert } from "@/lib/messaging/notify-incident-alert";
import type { IncidentSeverity, IncidentType } from "@/types/database";

const TYPES: IncidentType[] = [
  "breakdown",
  "accident",
  "delay",
  "medical",
  "behavior",
  "other",
];

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high"];

/**
 * GET  /api/incidents?severity=&tripId=
 * POST /api/incidents — matron report; high severity → admin SMS
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance", "matron", "driver", "director"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const severity = searchParams.get("severity");
  const tripId = searchParams.get("tripId");

  const supabase = await createClient();
  let q = supabase
    .from("incidents")
    .select(
      "id, trip_id, reported_by, type, severity, notes, lat, lng, created_at, trips(bus_id, buses(school_id))",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (severity && SEVERITIES.includes(severity as IncidentSeverity)) {
    q = q.eq("severity", severity);
  }
  if (tripId) q = q.eq("trip_id", tripId);

  const { data, error } = await q;
  if (error) {
    const missing =
      /Could not find the table ['"]?public\.incidents['"]?/i.test(
        error.message,
      ) || error.code === "PGRST205";
    return NextResponse.json(
      {
        error: error.message,
        ...(missing
          ? {
              hint: "Run supabase/schema_incidents.sql in the Supabase SQL Editor, then refresh this page.",
              setup: "schema_incidents.sql",
            }
          : {}),
      },
      { status: missing ? 503 : 400 },
    );
  }

  const incidents = (data ?? []).map((row) => {
    const { trips, ...rest } = row as typeof row & {
      trips?:
        | { bus_id: string; buses?: { school_id: string } | { school_id: string }[] | null }
        | { bus_id: string; buses?: { school_id: string } | { school_id: string }[] | null }[]
        | null;
    };
    const trip = Array.isArray(trips) ? trips[0] : trips;
    const buses = trip?.buses;
    const bus = Array.isArray(buses) ? buses[0] : buses;
    return { ...rest, school_id: bus?.school_id ?? null };
  });

  return NextResponse.json({ incidents });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    tripId?: string;
    type?: string;
    severity?: string;
    notes?: string;
    lat?: number | null;
    lng?: number | null;
    occurredAt?: string | null;
    late?: boolean;
  };

  if (!body.tripId?.trim()) {
    return NextResponse.json({ error: "tripId is required" }, { status: 400 });
  }

  if (!body.type || !TYPES.includes(body.type as IncidentType)) {
    return NextResponse.json(
      { error: `type must be one of: ${TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const severity = (body.severity ?? "medium") as IncidentSeverity;
  if (!SEVERITIES.includes(severity)) {
    return NextResponse.json(
      { error: "severity must be low|medium|high" },
      { status: 400 },
    );
  }

  let occurredAt: string | null = null;
  if (body.occurredAt) {
    const d = new Date(body.occurredAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "occurredAt must be a valid datetime" },
        { status: 400 },
      );
    }
    occurredAt = d.toISOString();
  }

  const outcome = await createIncident({
    tripId: body.tripId.trim(),
    type: body.type as IncidentType,
    severity,
    notes: body.notes ?? null,
    lat:
      typeof body.lat === "number" && Number.isFinite(body.lat)
        ? body.lat
        : null,
    lng:
      typeof body.lng === "number" && Number.isFinite(body.lng)
        ? body.lng
        : null,
    reportedBy: auth.userId,
    occurredAt,
    late: Boolean(body.late),
  });

  if ("error" in outcome) {
    const status = outcome.code === "not_found" ? 404 : 400;
    return NextResponse.json(
      { error: outcome.error, code: outcome.code },
      { status },
    );
  }

  let admin_alert = null;
  if (severity === "high" || body.type === "accident" || body.type === "breakdown") {
    admin_alert = await notifyIncidentAlert({
      incidentId: outcome.incident.id,
      tripId: body.tripId.trim(),
      type: body.type as IncidentType,
      severity,
      notes: body.notes ?? null,
    });
  }

  return NextResponse.json(
    { incident: outcome.incident, admin_alert },
    { status: 201 },
  );
}
