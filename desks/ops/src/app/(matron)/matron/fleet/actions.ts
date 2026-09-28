"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { getSchools } from "@/lib/db/queries";
import {
  createRoute as createRouteRow,
  createStop,
  getRouteById,
} from "@/lib/db/routes";
import type { TripDirection } from "@/types/database";

async function requireFleetAccess() {
  const session = await getSessionProfile();
  if (!session || !["admin", "matron"].includes(session.role)) {
    redirect("/");
  }
  return session;
}

async function defaultSchoolId(): Promise<string | null> {
  const schools = await getSchools();
  return schools[0]?.id ?? null;
}

export async function createBus(formData: FormData) {
  await requireFleetAccess();

  const plateNumber = String(formData.get("plate_number") ?? "").trim();
  if (!plateNumber) return;

  const label = String(formData.get("label") ?? "").trim();
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const schoolId =
    String(formData.get("school_id") ?? "").trim() ||
    (await defaultSchoolId());
  if (!schoolId) return;

  const supabase = await createClient();
  await supabase.from("buses").insert({
    school_id: schoolId,
    plate_number: plateNumber,
    label: label || plateNumber,
    capacity: capacityRaw ? Number(capacityRaw) : 40,
    active: true,
  });

  revalidatePath("/matron/fleet");
  revalidatePath("/admin/buses");
}

export async function createRoute(formData: FormData) {
  await requireFleetAccess();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const directionRaw = String(formData.get("direction") ?? "am").trim();
  const direction: TripDirection =
    directionRaw === "pm" ? "pm" : "am";
  const busId = String(formData.get("bus_id") ?? "").trim();
  const schoolId =
    String(formData.get("school_id") ?? "").trim() ||
    (await defaultSchoolId());
  if (!schoolId) return;

  const outcome = await createRouteRow({ schoolId, name, direction });
  if ("error" in outcome) return;

  if (busId) {
    const supabase = await createClient();
    await supabase
      .from("buses")
      .update({ route_id: outcome.route.id })
      .eq("id", busId);
  }

  revalidatePath("/matron/fleet");
}

export async function addRouteStop(formData: FormData) {
  await requireFleetAccess();

  const routeId = String(formData.get("route_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!routeId || !name) return;

  const route = await getRouteById(routeId);
  if (!route) return;

  const stopOutcome = await createStop({
    schoolId: route.school_id,
    name,
    kind: "pickup",
  });
  if ("error" in stopOutcome) return;

  const supabase = await createClient();

  // Auto-append after last stop — manual sequence field was error-prone (Day 9 bugfix).
  const { data: existing } = await supabase
    .from("route_stops")
    .select("stop_order")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: false })
    .limit(1);
  const nextOrder =
    existing && existing.length > 0 ? Number(existing[0].stop_order) + 1 : 0;

  const sequenceRaw = String(formData.get("sequence") ?? "").trim();
  const stopOrder = sequenceRaw !== "" ? Number(sequenceRaw) : nextOrder;

  await supabase.from("route_stops").insert({
    route_id: routeId,
    stop_id: stopOutcome.stop.id,
    stop_order: Number.isFinite(stopOrder) ? stopOrder : nextOrder,
  });

  revalidatePath("/matron/fleet");
  revalidatePath("/admin/routes");
  revalidatePath(`/admin/routes/${routeId}`);
}
