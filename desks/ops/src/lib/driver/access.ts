import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/roles";

export type DriverAccessOk = { ok: true };
export type DriverAccessDenied = { ok: false; status: 403 | 404; error: string };
export type DriverAccessResult = DriverAccessOk | DriverAccessDenied;

/**
 * Drivers may start a trip on any active bus (field swaps are common).
 * Assignment on the fleet record is a preferred default in the UI only.
 * Admins and other staff always pass.
 */
export async function assertDriverCanUseBus(
  supabase: SupabaseClient,
  opts: { userId: string; role: Role | null; busId: string },
): Promise<DriverAccessResult> {
  const { role, busId } = opts;
  if (role !== "driver") return { ok: true };

  const { data: bus, error: busErr } = await supabase
    .from("buses")
    .select("id, active")
    .eq("id", busId)
    .maybeSingle();

  if (busErr || !bus) {
    return { ok: false, status: 404, error: "Bus not found" };
  }

  if (bus.active === false) {
    return {
      ok: false,
      status: 403,
      error: "This bus is inactive — pick another bus",
    };
  }

  return { ok: true };
}

export async function assertDriverCanUseTrip(
  supabase: SupabaseClient,
  opts: { userId: string; role: Role | null; tripId: string },
): Promise<DriverAccessResult> {
  const { userId, role, tripId } = opts;
  if (role !== "driver") return { ok: true };

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, bus_id")
    .eq("id", tripId)
    .maybeSingle();

  if (error || !trip?.bus_id) {
    return { ok: false, status: 404, error: "Trip not found" };
  }

  return assertDriverCanUseBus(supabase, {
    userId,
    role,
    busId: trip.bus_id,
  });
}
