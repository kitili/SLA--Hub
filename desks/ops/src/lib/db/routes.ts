import { createClient } from "@/lib/supabase/server";
import type { Stop, StopKind, TripDirection } from "@/types/database";

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type RouteRow = {
  id: string;
  school_id: string;
  name: string;
  direction: TripDirection;
  active: boolean;
  created_at?: string;
};

export async function listRoutes(schoolId?: string): Promise<RouteRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("routes")
    .select("id, school_id, name, direction, active, created_at")
    .order("name");
  if (schoolId) q = q.eq("school_id", schoolId);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as RouteRow[];
}

export async function getRouteById(routeId: string): Promise<RouteRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routes")
    .select("id, school_id, name, direction, active, created_at")
    .eq("id", routeId)
    .maybeSingle();
  if (error || !data) return null;
  return data as RouteRow;
}

export async function createRoute(input: {
  schoolId: string;
  name: string;
  direction: TripDirection;
}): Promise<{ route: RouteRow } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routes")
    .insert({
      school_id: input.schoolId,
      name: input.name.trim(),
      direction: input.direction,
      active: true,
    })
    .select("id, school_id, name, direction, active, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create route" };
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("route_change_logs").insert({
      route_id: data.id,
      event_type: "created",
      summary: `Route created: ${data.name} (${data.direction})`,
      actor_id: user?.id ?? null,
    });
  } catch {
    // table may not exist yet
  }
  return { route: data as RouteRow };
}

export async function updateRoute(
  routeId: string,
  patch: Partial<{ name: string; direction: TripDirection; active: boolean }>,
): Promise<{ route: RouteRow } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.name != null) update.name = patch.name.trim();
  if (patch.direction != null) update.direction = patch.direction;
  if (patch.active != null) update.active = patch.active;

  const { data, error } = await supabase
    .from("routes")
    .update(update)
    .eq("id", routeId)
    .select("id, school_id, name, direction, active, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update route" };
  return { route: data as RouteRow };
}

export type RouteStopExportJoinRow = {
  route_id: string;
  route_name: string;
  direction: TripDirection;
  school_slug: string;
  stop_order: number;
  stop_name: string;
  stop_kind: StopKind;
  lat: number | null;
  lng: number | null;
  eta_offset_minutes: number | null;
};

/** One row per route-stop, across every route -- used by the CSV export. */
export async function listAllRouteStopsForExport(): Promise<RouteStopExportJoinRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("route_stops")
    .select(
      `
      stop_order,
      eta_offset_minutes,
      routes ( id, name, direction, schools ( slug ) ),
      stops ( name, kind, lat, lng )
    `,
    )
    .order("route_id")
    .order("stop_order");
  if (error || !data) return [];

  return data.flatMap((row) => {
    const route = first(
      row.routes as
        | { id: string; name: string; direction: TripDirection; schools: { slug: string } | { slug: string }[] | null }
        | { id: string; name: string; direction: TripDirection; schools: { slug: string } | { slug: string }[] | null }[]
        | null,
    );
    const stop = first(
      row.stops as
        | { name: string; kind: StopKind; lat: number | null; lng: number | null }
        | { name: string; kind: StopKind; lat: number | null; lng: number | null }[]
        | null,
    );
    if (!route || !stop) return [];
    const school = first(route.schools);
    return [
      {
        route_id: route.id,
        route_name: route.name,
        direction: route.direction,
        school_slug: school?.slug ?? "",
        stop_order: row.stop_order as number,
        stop_name: stop.name,
        stop_kind: stop.kind,
        lat: stop.lat,
        lng: stop.lng,
        eta_offset_minutes: row.eta_offset_minutes as number | null,
      },
    ];
  });
}

export async function listStops(schoolId?: string): Promise<Stop[]> {
  const supabase = await createClient();
  let q = supabase
    .from("stops")
    .select("id, school_id, name, lat, lng, kind")
    .order("name");
  if (schoolId) q = q.eq("school_id", schoolId);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as Stop[];
}

export async function createStop(input: {
  schoolId: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  kind?: StopKind;
}): Promise<{ stop: Stop } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stops")
    .insert({
      school_id: input.schoolId,
      name: input.name.trim(),
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      kind: input.kind ?? "pickup",
    })
    .select("id, school_id, name, lat, lng, kind")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create stop" };
  return { stop: data as Stop };
}

export async function updateStop(
  stopId: string,
  patch: Partial<{
    name: string;
    lat: number | null;
    lng: number | null;
    kind: StopKind;
  }>,
): Promise<{ stop: Stop } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stops")
    .update(patch)
    .eq("id", stopId)
    .select("id, school_id, name, lat, lng, kind")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update stop" };
  return { stop: data as Stop };
}

/** Deletes a stop (route_stops + student assignments cascade via FK). */
export async function deleteStop(
  stopId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("stops").delete().eq("id", stopId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function setRouteStops(input: {
  routeId: string;
  stops: { stopId: string; order: number; etaOffsetMinutes?: number | null }[];
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  const { error: delError } = await supabase
    .from("route_stops")
    .delete()
    .eq("route_id", input.routeId);
  if (delError) return { error: delError.message };

  if (input.stops.length === 0) return { ok: true };

  const { error } = await supabase.from("route_stops").insert(
    input.stops.map((s) => ({
      route_id: input.routeId,
      stop_id: s.stopId,
      stop_order: s.order,
      eta_offset_minutes: s.etaOffsetMinutes ?? null,
    })),
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function assignStudentToStop(input: {
  studentId: string;
  stopId: string;
  routeId?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  // A student rides one bus at a time. Clear any prior stop assignment(s)
  // first -- otherwise re-assigning a student (a new pickup point, a route
  // change) leaves the old row behind, and it can point at a route none of
  // their current buses serve, silently failing the boarding-scan check.
  const { error: clearError } = await supabase
    .from("student_stop_assignments")
    .delete()
    .eq("student_id", input.studentId);
  if (clearError) return { error: clearError.message };

  const { error } = await supabase.from("student_stop_assignments").insert({
    student_id: input.studentId,
    stop_id: input.stopId,
    route_id: input.routeId ?? null,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Day 7 (coordinate-based): create a dedicated stop at the exact
 * parent-given lat/lng for one student, append it to the route's stop
 * order, and link the student to it. No proximity matching — every
 * student gets their own stop, even if a neighbor's point is nearby.
 */
export async function assignStudentToCoordinate(input: {
  studentId: string;
  routeId: string;
  schoolId: string;
  lat: number;
  lng: number;
  stopName?: string;
}): Promise<{ ok: true; stopId: string } | { error: string }> {
  const supabase = await createClient();

  const created = await createStop({
    schoolId: input.schoolId,
    name: input.stopName?.trim() || "Pickup point",
    lat: input.lat,
    lng: input.lng,
    kind: "pickup",
  });
  if ("error" in created) return created;
  const stopId = created.stop.id;

  const { data: last, error: lastError } = await supabase
    .from("route_stops")
    .select("stop_order")
    .eq("route_id", input.routeId)
    .order("stop_order", { ascending: false })
    .limit(1);
  if (lastError) return { error: lastError.message };
  const nextOrder = (last?.[0]?.stop_order ?? -1) + 1;

  const { error: insertError } = await supabase.from("route_stops").insert({
    route_id: input.routeId,
    stop_id: stopId,
    stop_order: nextOrder,
  });
  if (insertError) return { error: insertError.message };

  const assigned = await assignStudentToStop({
    studentId: input.studentId,
    stopId,
    routeId: input.routeId,
  });
  if ("error" in assigned) return assigned;

  return { ok: true, stopId };
}

export type StudentPickupDetails = {
  current: {
    stopId: string;
    stopName: string;
    lat: number | null;
    lng: number | null;
    routeId: string | null;
    routeName: string | null;
    busLabel: string | null;
  } | null;
  activeOverride: {
    id: string;
    lat: number;
    lng: number;
    name: string | null;
    startsOn: string;
    endsOn: string;
    reason: string | null;
  } | null;
  routes: { id: string; name: string; direction: TripDirection; busLabel: string | null }[];
};

/** Everything the student Edit pop-up needs for its Pickup point section. */
export async function getStudentPickupDetails(
  studentId: string,
  today: string,
): Promise<StudentPickupDetails | { error: string }> {
  const supabase = await createClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", studentId)
    .maybeSingle();
  if (studentError) return { error: studentError.message };
  if (!student) return { error: "Student not found" };

  const [assignmentRes, routes, busesRes, overrideRes] = await Promise.all([
    supabase
      .from("student_stop_assignments")
      .select("stop_id, route_id, stops ( id, name, lat, lng )")
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle(),
    listRoutes(student.school_id),
    supabase
      .from("buses")
      .select("label, route_id")
      .eq("school_id", student.school_id)
      .eq("active", true),
    supabase
      .from("student_stop_temporary_overrides")
      .select("id, override_lat, override_lng, override_name, starts_on, ends_on, reason")
      .eq("student_id", studentId)
      .gte("ends_on", today)
      .order("starts_on")
      .limit(1)
      .maybeSingle(),
  ]);

  const busByRoute = new Map<string, string>();
  for (const b of (busesRes.data ?? []) as { label: string; route_id: string | null }[]) {
    if (b.route_id && !busByRoute.has(b.route_id)) busByRoute.set(b.route_id, b.label);
  }
  const routeName = new Map(routes.map((r) => [r.id, r.name]));

  const a = assignmentRes.data as {
    stop_id: string;
    route_id: string | null;
    stops:
      | { id: string; name: string; lat: number | null; lng: number | null }
      | { id: string; name: string; lat: number | null; lng: number | null }[]
      | null;
  } | null;
  const stop = first(a?.stops ?? null);

  // The overrides table may not exist yet on an older database — treat that
  // as "no temporary pickup" rather than failing the whole section.
  const o = overrideRes.error ? null : overrideRes.data;

  return {
    current: a
      ? {
          stopId: a.stop_id,
          stopName: stop?.name ?? "Pickup point",
          lat: stop?.lat ?? null,
          lng: stop?.lng ?? null,
          routeId: a.route_id,
          routeName: a.route_id ? (routeName.get(a.route_id) ?? null) : null,
          busLabel: a.route_id ? (busByRoute.get(a.route_id) ?? null) : null,
        }
      : null,
    activeOverride: o
      ? {
          id: o.id,
          lat: Number(o.override_lat),
          lng: Number(o.override_lng),
          name: o.override_name,
          startsOn: o.starts_on,
          endsOn: o.ends_on,
          reason: o.reason,
        }
      : null,
    routes: routes
      .filter((r) => r.active)
      .map((r) => ({
        id: r.id,
        name: r.name,
        direction: r.direction,
        busLabel: busByRoute.get(r.id) ?? null,
      })),
  };
}

/**
 * Permanently moves a student to a new pickup coordinate (pilot feedback #2).
 * Reuses assignStudentToCoordinate, then tidies up behind it:
 *  - the old stop comes off its route if no other student still uses it, so
 *    the bus isn't sent to the old house any more;
 *  - temporary pickups tied to the old stop are removed, since they'd now
 *    override a stop the student no longer has. When the move comes from
 *    "Make this permanent", that override is removed too.
 */
export async function moveStudentPickupPermanently(input: {
  studentId: string;
  routeId: string;
  lat: number;
  lng: number;
  stopName?: string;
  fromOverrideId?: string;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", input.studentId)
    .maybeSingle();
  if (studentError) return { error: studentError.message };
  if (!student) return { error: "Student not found" };

  const route = await getRouteById(input.routeId);
  if (!route || route.school_id !== student.school_id) {
    return { error: "That route isn't on this student's campus" };
  }

  const { data: previous } = await supabase
    .from("student_stop_assignments")
    .select("stop_id, route_id")
    .eq("student_id", input.studentId);

  const moved = await assignStudentToCoordinate({
    studentId: input.studentId,
    routeId: input.routeId,
    schoolId: student.school_id,
    lat: input.lat,
    lng: input.lng,
    stopName: input.stopName,
  });
  if ("error" in moved) return moved;

  const warnings: string[] = [];
  for (const old of (previous ?? []) as { stop_id: string; route_id: string | null }[]) {
    if (old.stop_id === moved.stopId) continue;

    const { count } = await supabase
      .from("student_stop_assignments")
      .select("student_id", { count: "exact", head: true })
      .eq("stop_id", old.stop_id);
    if ((count ?? 0) === 0 && old.route_id) {
      const { error } = await supabase
        .from("route_stops")
        .delete()
        .eq("route_id", old.route_id)
        .eq("stop_id", old.stop_id);
      if (error) warnings.push(`old stop still on route: ${error.message}`);
    }

    const { error: overrideError } = await supabase
      .from("student_stop_temporary_overrides")
      .delete()
      .eq("student_id", input.studentId)
      .eq("original_stop_id", old.stop_id);
    if (overrideError) warnings.push(`old temporary pickup kept: ${overrideError.message}`);
  }

  if (input.fromOverrideId) {
    const { error } = await supabase
      .from("student_stop_temporary_overrides")
      .delete()
      .eq("id", input.fromOverrideId)
      .eq("student_id", input.studentId);
    if (error) warnings.push(`temporary pickup kept: ${error.message}`);
  }

  // The move itself succeeded; only report clean-up problems.
  if (warnings.length) {
    return { error: `Pickup moved, but clean-up failed (${warnings.join("; ")})` };
  }
  return { ok: true };
}

export async function listStudentStopAssignments(routeId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("student_stop_assignments")
    .select(
      `
      student_id,
      stop_id,
      route_id,
      students ( id, first_name, last_name, class_name ),
      stops ( id, name, lat, lng )
    `,
    );
  if (routeId) q = q.eq("route_id", routeId);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((row) => {
    const student = first(
      row.students as
        | {
            id: string;
            first_name: string;
            last_name: string;
            class_name: string | null;
          }
        | {
            id: string;
            first_name: string;
            last_name: string;
            class_name: string | null;
          }[]
        | null,
    );
    const stop = first(
      row.stops as
        | { id: string; name: string; lat: number | null; lng: number | null }
        | { id: string; name: string; lat: number | null; lng: number | null }[]
        | null,
    );
    return {
      student_id: row.student_id as string,
      stop_id: row.stop_id as string,
      route_id: row.route_id as string | null,
      student,
      stop,
    };
  });
}

export async function getRouteCapacityCheck(routeId: string): Promise<{
  assigned_students: number;
  bus_capacity_total: number;
  buses: { id: string; label: string; capacity: number }[];
  over_capacity: boolean;
}> {
  const supabase = await createClient();

  const { count: assigned } = await supabase
    .from("student_stop_assignments")
    .select("student_id", { count: "exact", head: true })
    .eq("route_id", routeId);

  const { data: buses } = await supabase
    .from("buses")
    .select("id, label, capacity")
    .eq("route_id", routeId)
    .eq("active", true);

  const busList = (buses ?? []) as {
    id: string;
    label: string;
    capacity: number;
  }[];
  const capacity = busList.reduce((sum, b) => sum + (b.capacity || 0), 0);
  const assigned_students = assigned ?? 0;

  return {
    assigned_students,
    bus_capacity_total: capacity,
    buses: busList,
    over_capacity: capacity > 0 && assigned_students > capacity,
  };
}
